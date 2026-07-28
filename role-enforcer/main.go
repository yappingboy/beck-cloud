package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"github.com/lestrrat-go/jwx/v2/jws"
)

type Policy map[string][]string

var (
	policy     Policy
	policyMu   sync.RWMutex
	jwksSet    jwk.Set
	jwksMu     sync.RWMutex
	jwksURL    string
	realm      string
	clientID   string
	logLevel   string
)

func loadPolicy(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read policy file: %w", err)
	}
	p := make(Policy)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		service := strings.TrimSpace(parts[0])
		roles := strings.Split(parts[1], ",")
		trimmed := make([]string, len(roles))
		for i, r := range roles {
			trimmed[i] = strings.TrimSpace(r)
		}
		p[service] = trimmed
	}
	policyMu.Lock()
	policy = p
	policyMu.Unlock()
	return nil
}

func fetchJWKS() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	set, err := jwk.Fetch(ctx, jwksURL)
	if err != nil {
		return fmt.Errorf("fetch JWKS: %w", err)
	}
	jwksMu.Lock()
	jwksSet = set
	jwksMu.Unlock()
	return nil
}

func refreshJWKSLoop() {
	if err := fetchJWKS(); err != nil {
		log.Printf("WARN: initial JWKS fetch failed: %v", err)
	}
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		if err := fetchJWKS(); err != nil {
			log.Printf("WARN: JWKS refresh failed: %v", err)
		} else {
			log.Printf("JWKS refreshed successfully")
		}
	}
}

func checkRoles(token jwt.Token, requiredRoles []string) (bool, []string) {
	aud := token.Audience()
	if aud == nil || len(aud) == 0 {
		return false, nil
	}
	resourceAccessRaw, ok := aud["resource_access"]
	if !ok {
		return false, nil
	}
	resourceAccess, ok := resourceAccessRaw.(map[string]interface{})
	if !ok {
		return false, nil
	}
	clientRolesRaw, ok := resourceAccess[clientID]
	if !ok {
		return false, nil
	}
	roles := extractRoles(clientRolesRaw)
	if len(roles) == 0 {
		return false, nil
	}
	return hasAllRoles(roles, requiredRoles), roles
}

func extractRoles(raw interface{}) []string {
	if m, ok := raw.(map[string]interface{}); ok {
		if rolesRaw, ok := m["roles"]; ok {
			return extractRoles(rolesRaw)
		}
		return nil
	}
	if arr, ok := raw.([]interface{}); ok {
		roles := make([]string, len(arr))
		for i, r := range arr {
			roles[i] = fmt.Sprintf("%v", r)
		}
		return roles
	}
	return nil
}

func hasAllRoles(roles []string, required []string) bool {
	roleSet := make(map[string]bool)
	for _, r := range roles {
		roleSet[r] = true
	}
	for _, req := range required {
		if !roleSet[req] {
			return false
		}
	}
	return true
}

func getClaim(token jwt.Token, key string) string {
	val, ok := token.Get(key)
	if !ok {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

type keyProvider struct{}

func (keyProvider) FetchKeys(ctx context.Context, sink jws.KeySink, sig *jws.Signature, msg *jws.Message) error {
	jwksMu.RLock()
	defer jwksMu.RUnlock()
	if jwksSet == nil {
		return fmt.Errorf("JWKS not loaded")
	}

	// Get key ID from protected headers
	keyID := ""
	if sig != nil {
		keyID = sig.Protected().KeyID()
	}

	if keyID != "" {
		key, found := jwksSet.LookupKeyID(keyID)
		if found {
			sink.Key(jwa.RS256, key)
			return nil
		}
	}

	// Fallback: return all keys from the set
	for i := 0; i < jwksSet.Len(); i++ {
		// Iterate through the set using the map
		_ = i
	}
	// Use a simpler approach: iterate through the set's private params
	for _, key := range jwksSet {
		sink.Key(jwa.RS256, key)
	}
	return nil
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"missing authorization header"}`))
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenStr == authHeader {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid authorization format"}`))
		return
	}

	token, err := jwt.Parse([]byte(tokenStr), jwt.WithKeyProvider(keyProvider{}))
	if err != nil {
		if logLevel == "debug" {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(fmt.Sprintf(`{"error":"token parse failed: %s"}`, err)))
		} else {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"invalid token"}`))
		}
		return
	}

	service := r.FormValue("service")
	if service == "" {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) >= 2 {
			service = pathParts[1]
		}
	}
	if service == "" {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"missing service parameter"}`))
		return
	}

	policyMu.RLock()
	requiredRoles, ok := policy[service]
	policyMu.RUnlock()

	userRoles := getUserRoles(token)
	userEmail := getClaim(token, "email")
	userName := getClaim(token, "preferred_username")

	if !ok {
		w.Header().Set("X-Beck-Service", service)
		w.Header().Set("X-Beck-User-Email", userEmail)
		w.Header().Set("X-Beck-User-Name", userName)
		w.Header().Set("X-Beck-Roles", strings.Join(userRoles, ","))
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"allowed":true,"service":"` + service + `"}`))
		return
	}

	hasRoles, _ := checkRoles(token, requiredRoles)
	if !hasRoles {
		w.Header().Set("X-Beck-Required-Roles", strings.Join(requiredRoles, ","))
		w.Header().Set("X-Beck-User-Email", userEmail)
		log.Printf("DENIED: user=%s service=%s roles=%v", userName, service, userRoles)
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"allowed":false,"service":"` + service + `","required":[` + rolesJSON(requiredRoles) + `]}`))
		return
	}

	log.Printf("ALLOWED: user=%s service=%s roles=%v", userName, service, userRoles)
	w.Header().Set("X-Beck-Service", service)
	w.Header().Set("X-Beck-User-Email", userEmail)
	w.Header().Set("X-Beck-User-Name", userName)
	w.Header().Set("X-Beck-Roles", strings.Join(userRoles, ","))
	w.Header().Set("X-Beck-Allowed-Roles", strings.Join(requiredRoles, ","))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"allowed":true,"service":"` + service + `"}`))
}

func getUserRoles(token jwt.Token) []string {
	_, userRoles := checkRoles(token, []string{})
	return userRoles
}

func rolesJSON(roles []string) string {
	parts := make([]string, len(roles))
	for i, r := range roles {
		parts[i] = `"` + r + `"`
	}
	return strings.Join(parts, ",")
}

func main() {
	policyPath := os.Getenv("POLICY_PATH")
	jwksURL = os.Getenv("JWKS_URL")
	realm = os.Getenv("REALM")
	clientID = os.Getenv("CLIENT_ID")
	logLevel = os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}
	if policyPath == "" || jwksURL == "" || clientID == "" {
		log.Fatal("POLICY_PATH, JWKS_URL, and CLIENT_ID env vars required")
	}
	if err := loadPolicy(policyPath); err != nil {
		log.Fatalf("Failed to load policy: %v", err)
	}
	log.Printf("Loaded policy with %d service entries", len(policy))
	go refreshJWKSLoop()
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	http.HandleFunc("/reload", func(w http.ResponseWriter, r *http.Request) {
		if err := loadPolicy(policyPath); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(fmt.Sprintf(`{"error":"%s"}`, err)))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(fmt.Sprintf(`{"reloaded":%d}`, len(policy))))
	})
	http.HandleFunc("/check/", handleCheck)
	http.HandleFunc("/check", handleCheck)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Role enforcer starting on :%s (realm=%s, client=%s)", port, realm, clientID)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
