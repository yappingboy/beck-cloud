package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

// Tier definitions
type Tier string

const (
	TierFree    Tier = "free"
	TierStarter Tier = "starter" // $3/mo
	TierBuilder Tier = "builder" // $7/mo
	TierPro     Tier = "pro"     // $12/mo
)

// API key record
type APIKey struct {
	KeyID     string `json:"keyId"`
	KeyHash   string `json:"-"`          // stored hash, never returned
	APIKey    string `json:"apiKey"`     // plaintext key (shown once on creation)
	UserID    string `json:"userId"`
	Tier      Tier   `json:"tier"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt,omitempty"`
	Active    bool   `json:"active"`
	// Rate limits per minute
	RateLimit int `json:"rateLimit"`
	// Monthly quota
	MonthlyQuota int `json:"monthlyQuota"`
}

type AuthRequest struct {
	UserID   string `json:"userId"`
	Tier     string `json:"tier"`
	Note     string `json:"note,omitempty"`
	Expiry   string `json:"expiry,omitempty"` // RFC3339, empty = no expiry
}

type AuthResponse struct {
	Status string  `json:"status"`
	Result *APIKey `json:"result,omitempty"`
	Error  string  `json:"error,omitempty"`
	Meta   Meta    `json:"meta"`
}

type Meta struct {
	RequestID string `json:"requestId"`
}

type TokenResponse struct {
	Status string `json:"status"`
	Result struct {
		Token     string `json:"token"`
		ExpiresAt string `json:"expiresAt"`
		Tier      Tier   `json:"tier"`
	} `json:"result"`
	Meta Meta `json:"meta"`
}

type JWTClaims struct {
	KeyID   string `json:"keyId"`
	UserID  string `json:"userId"`
	Tier    string `json:"tier"`
	RateLim int    `json:"rateLim"`
	jwt.RegisteredClaims
}

var (
	rdb *redis.Client

	authRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "micro", Subsystem: "auth_service", Name: "http_requests_total", Help: "Total HTTP requests.",
	}, []string{"method", "status"})
	authDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "micro", Subsystem: "auth_service", Name: "http_request_duration_seconds", Help: "Request duration.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
	}, []string{"method", "endpoint"})
	authActive = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "micro", Subsystem: "auth_service", Name: "http_active_requests", Help: "Active requests.",
	})
)

func wrap(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t := time.Now(); authActive.Inc(); defer authActive.Dec()
		sw := &sw{w, http.StatusOK}; h(sw, r)
		authRequests.WithLabelValues(r.Method, fmt.Sprintf("%d", sw.c)).Inc()
		authDuration.WithLabelValues(r.Method, r.URL.Path).Observe(time.Since(t).Seconds())
	}
}
type sw struct{ http.ResponseWriter; c int }
func (s *sw) WriteHeader(code int) { s.c = code; s.ResponseWriter.WriteHeader(code) }

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func genID() string { return uuid.New().String() }

// hashAPIKey hashes the raw key for storage
func hashAPIKey(rawKey string) string {
	h := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(h[:])
}

// generateAPIKey generates a random 40-char hex key
func generateAPIKey() string {
	b := make([]byte, 20)
	rand.Read(b)
	return "bkl_" + hex.EncodeToString(b)
}

// tierLimits returns rate limit (req/min) and monthly quota per tier
func tierLimits(t Tier) (int, int) {
	switch t {
	case TierStarter:
		return 60, 10000
	case TierBuilder:
		return 120, 50000
	case TierPro:
		return 300, 200000
	default:
		return 10, 1000 // free tier
	}
}

func createKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, AuthResponse{Status: "error", Error: "method not allowed", Meta: Meta{RequestID: genID()}})
		return
	}
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, AuthResponse{Status: "error", Error: "invalid JSON", Meta: Meta{RequestID: genID()}})
		return
	}
	if req.UserID == "" {
		writeJSON(w, 400, AuthResponse{Status: "error", Error: "userId required", Meta: Meta{RequestID: genID()}})
		return
	}

	tier := TierFree
	switch req.Tier {
	case "starter":
		tier = TierStarter
	case "builder":
		tier = TierBuilder
	case "pro":
		tier = TierPro
	}

	rawKey := generateAPIKey()
	keyHash := hashAPIKey(rawKey)
	keyID := uuid.New().String()
	rateLimit, monthlyQuota := tierLimits(tier)

	now := time.Now().UTC().Format(time.RFC3339)
	apiKey := APIKey{
		KeyID:      keyID,
		KeyHash:    keyHash,
		APIKey:     rawKey, // shown only on creation
		UserID:     req.UserID,
		Tier:       tier,
		CreatedAt:  now,
		Active:     true,
		RateLimit:  rateLimit,
		MonthlyQuota: monthlyQuota,
	}

	if req.Expiry != "" {
		apiKey.ExpiresAt = req.Expiry
	}

	// Store in Redis: auth:keys:{keyHash} -> JSON
	keyJSON, _ := json.Marshal(apiKey)
	ctx := context.Background()
	err := rdb.Set(ctx, "auth:keys:"+keyHash, keyJSON, 0).Err()
	if err != nil {
		writeJSON(w, 500, AuthResponse{Status: "error", Error: "storage error", Meta: Meta{RequestID: genID()}})
		return
	}

	// Index by user: auth:users:{userID}:keys -> set of keyHashes
	rdb.SAdd(ctx, "auth:users:"+req.UserID+":keys", keyHash)

	writeJSON(w, 201, AuthResponse{Status: "success", Result: &apiKey, Meta: Meta{RequestID: genID()}})
}

// validateAPIKey validates an API key and returns a JWT
func validateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, TokenResponse{Meta: Meta{RequestID: genID()}})
		return
	}
	var body struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, TokenResponse{Meta: Meta{RequestID: genID()}})
		return
	}

	keyHash := hashAPIKey(body.APIKey)
	ctx := context.Background()
	val, err := rdb.Get(ctx, "auth:keys:"+keyHash).Result()
	if err != nil {
		writeJSON(w, 401, TokenResponse{Meta: Meta{RequestID: genID()}})
		return
	}

	var apiKey APIKey
	json.Unmarshal([]byte(val), &apiKey)

	if !apiKey.Active {
		writeJSON(w, 403, TokenResponse{Meta: Meta{RequestID: genID()}})
		return
	}

	if apiKey.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, apiKey.ExpiresAt); err == nil && time.Now().After(t) {
			writeJSON(w, 410, TokenResponse{Meta: Meta{RequestID: genID()}})
			return
		}
	}

	// Generate JWT
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	expiryHours, _ := strconv.Atoi(os.Getenv("JWT_EXPIRY_HOURS"))
	if expiryHours <= 0 {
		expiryHours = 720
	}

	claims := JWTClaims{
		KeyID:   apiKey.KeyID,
		UserID:  apiKey.UserID,
		Tier:    string(apiKey.Tier),
		RateLim: apiKey.RateLimit,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiryHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "becklab-auth",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString(jwtSecret)

	writeJSON(w, 200, TokenResponse{
		Status: "success",
		Result: struct {
			Token     string `json:"token"`
			ExpiresAt string `json:"expiresAt"`
			Tier      Tier   `json:"tier"`
		}{
			Token:     tokenStr,
			ExpiresAt: claims.ExpiresAt.Time.Format(time.RFC3339),
			Tier:      apiKey.Tier,
		},
		Meta: Meta{RequestID: genID()},
	})
}

// validateJWT middleware-ready endpoint — accepts Authorization: Bearer <token>
func checkTokenHandler(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		writeJSON(w, 401, map[string]string{"status": "error", "error": "no token"})
		return
	}
	parts := "Bearer "
	tokenStr := auth[len(parts):]

	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		writeJSON(w, 401, map[string]string{"status": "error", "error": "invalid token"})
		return
	}

	claims := token.Claims.(*JWTClaims)
	writeJSON(w, 200, map[string]interface{}{
		"status": "valid",
		"result": map[string]interface{}{
			"keyId":   claims.KeyID,
			"userId":  claims.UserID,
			"tier":    claims.Tier,
			"rateLim": claims.RateLim,
		},
	})
}

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPass := os.Getenv("REDIS_PASSWORD")
	if redisHost == "" {
		redisHost = "localhost"
	}
	if redisPort == "" {
		redisPort = "6379"
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     redisHost + ":" + redisPort,
		Password: redisPass,
		DB:       0,
	})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis connection failed: %v", err)
	}
	log.Printf("Connected to Redis at %s:%s", redisHost, redisPort)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/keys", wrap(createKeyHandler))
	mux.HandleFunc("/api/v1/validate", wrap(validateHandler))
	mux.HandleFunc("/api/v1/token", wrap(checkTokenHandler))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.Handle("/metrics", promhttp.Handler())

	log.Printf("auth-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
