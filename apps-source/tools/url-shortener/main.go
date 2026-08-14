package main

import (
	"net"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "modernc.org/sqlite"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	shortenerRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "micro", Subsystem: "shortener", Name: "http_requests_total",
		Help: "Total HTTP requests by method and status.",
	}, []string{"method", "status"})
	shortenerDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "micro", Subsystem: "shortener", Name: "http_request_duration_seconds",
		Help: "HTTP request duration in seconds.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
	}, []string{"method", "endpoint"})
	shortenerActive = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "micro", Subsystem: "shortener", Name: "http_active_requests", Help: "Active requests.",
	})
)

func metricsWrap(h http.HandlerFunc, svc string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t := time.Now(); shortenerActive.Inc(); defer shortenerActive.Dec()
		sw := &sw{w, http.StatusOK}; h(sw, r)
		shortenerRequests.WithLabelValues(r.Method, fmt.Sprintf("%d", sw.code)).Inc()
		shortenerDuration.WithLabelValues(r.Method, r.URL.Path).Observe(time.Since(t).Seconds())
	}
}
type sw struct{ http.ResponseWriter; code int }
func (s *sw) WriteHeader(c int) { s.code = c; s.ResponseWriter.WriteHeader(c) }

type link struct {
	ID          string `json:"id"`
	ShortCode   string `json:"shortCode"`
	OriginalURL string `json:"originalUrl"`
	CreatedAt   string `json:"createdAt"`
	ExpiresAt   string `json:"expiresAt,omitempty"`
}

type click struct {
	ID        string `json:"id"`
	ShortCode string `json:"shortCode"`
	IP        string `json:"ip"`
	UserAgent string `json:"userAgent"`
	Referrer  string `json:"referrer"`
	Timestamp string `json:"timestamp"`
}

type request struct {
	OriginalURL string `json:"originalUrl"`
	CustomCode  string `json:"customCode,omitempty"`
	ExpiresIn   int    `json:"expiresIn,omitempty"` // seconds, 0 = no expiry
}

type response struct {
	Status string      `json:"status"`
	Result interface{} `json:"result"`
	Meta   meta       `json:"meta"`
}

type meta struct {
	RequestID string `json:"requestId"`
}

var db *sql.DB

func initDB() error {
	var err error
	db, err = sql.Open("sqlite", "/data/shortener.db")
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS links (
			short_code TEXT PRIMARY KEY,
			original_url TEXT NOT NULL,
			created_at TEXT NOT NULL,
			expires_at TEXT
		);
		CREATE TABLE IF NOT EXISTS clicks (
			id TEXT PRIMARY KEY,
			short_code TEXT NOT NULL,
			ip TEXT,
			user_agent TEXT,
			referrer TEXT,
			timestamp TEXT NOT NULL,
			FOREIGN KEY (short_code) REFERENCES links(short_code)
		);
	`)
	return err
}

func genCode(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	rand.Read(b)
	for i := range b {
		b[i] = chars[b[i]%byte(len(chars))]
	}
	return string(b)
}

func shortenerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
		return
	}

	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.OriginalURL == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "originalUrl required"}, Meta: meta{RequestID: genID()}})
		return
	}

	code := genCode(6)
	if req.CustomCode != "" {
		code = strings.ReplaceAll(req.CustomCode, " ", "")
		if len(code) < 3 || len(code) > 20 {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "customCode must be 3-20 chars"}, Meta: meta{RequestID: genID()}})
			return
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	var expiresAt *string
	if req.ExpiresIn > 0 {
		exp := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second).UTC().Format(time.RFC3339)
		expiresAt = &exp
	}

	_, err := db.Exec("INSERT INTO links (short_code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)",
		code, req.OriginalURL, now, expiresAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "database error"}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{
		Status: "success",
		Result: map[string]string{"shortCode": code, "url": fmt.Sprintf("https://short.tools.becklab.cloud/%s", code)},
		Meta:   meta{RequestID: genID()},
	})
}

func redirectHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/")
	if code == "" || code == "healthz" {
		http.NotFound(w, r)
		return
	}

	var originalURL, expiresAt string
	err := db.QueryRow("SELECT original_url, expires_at FROM links WHERE short_code = ?", code).Scan(&originalURL, &expiresAt)
	if err == sql.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}

	if expiresAt != "" && time.Now().After(mustParse(expiresAt)) {
		db.Exec("DELETE FROM links WHERE short_code = ?", code)
		http.NotFound(w, r)
		return
	}

	ip := getClientIP(r)
	_ = recordClick(code, ip, r.UserAgent(), r.Referer())
	http.Redirect(w, r, originalURL, http.StatusFound)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/api/v1/links/")
	if code == "" || code == "healthz" {
		http.NotFound(w, r)
		return
	}

	var count int
	db.QueryRow("SELECT COUNT(*) FROM clicks WHERE short_code = ?", code).Scan(&count)
	writeJSON(w, http.StatusOK, response{
		Status: "success",
		Result: map[string]interface{}{"shortCode": code, "clicks": count},
		Meta:   meta{RequestID: genID()},
	})
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For, then X-Real-IP, then RemoteAddr
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

func recordClick(shortCode, ip, ua, ref string) error {
	id := genID()
	ts := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec("INSERT INTO clicks (id, short_code, ip, user_agent, referrer, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
		id, shortCode, ip, ua, ref, ts)
	return err
}

func mustParse(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func genID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func main() {
	if err := initDB(); err != nil {
		log.Fatalf("init db: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/links", metricsWrap(shortenerHandler, "shortener"))
	mux.HandleFunc("/api/v1/links/", metricsWrap(statsHandler, "shortener"))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/", metricsWrap(redirectHandler, "shortener"))

	log.Printf("shortener listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
