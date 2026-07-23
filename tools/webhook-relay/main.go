package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type endpoint struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	Secret     string `json:"secret,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

type delivery struct {
	ID        string `json:"id"`
	EndpointID string `json:"endpointId"`
	Payload   string `json:"payload"`
	Headers   string `json:"headers"`
	Attempts  int    `json:"attempts"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	LastError string `json:"lastError,omitempty"`
}

type request struct {
	URL        string            `json:"url"`
	Payload    json.RawMessage   `json:"payload"`
	Headers    map[string]string `json:"headers,omitempty"`
	Secret     string            `json:"secret,omitempty"`
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
	db, err = sql.Open("sqlite", "/data/webhook-relay.db")
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS endpoints (
			id TEXT PRIMARY KEY,
			url TEXT NOT NULL,
			secret TEXT,
			created_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS deliveries (
			id TEXT PRIMARY KEY,
			endpoint_id TEXT NOT NULL,
			payload TEXT NOT NULL,
			headers TEXT,
			attempts INTEGER DEFAULT 0,
			status TEXT DEFAULT 'pending',
			created_at TEXT NOT NULL,
			last_error TEXT,
			FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
		);
	`)
	return err
}

func genID() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano()%256 + i)
	}
	return fmt.Sprintf("%x", b)
}

func endpointsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listEndpoints(w, r)
	case http.MethodPost:
		createEndpoint(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
	}
}

func endpointHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/endpoints/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		getEndpoint(w, r, id)
	case http.MethodDelete:
		deleteEndpoint(w, r, id)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
	}
}

func listEndpoints(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, url, secret, created_at FROM endpoints")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}
	defer rows.Close()

	var eps []endpoint
	for rows.Next() {
		var e endpoint
		rows.Scan(&e.ID, &e.URL, &e.Secret, &e.CreatedAt)
		eps = append(eps, e)
	}
	writeJSON(w, http.StatusOK, response{Status: "success", Result: eps, Meta: meta{RequestID: genID()}})
}

func createEndpoint(w http.ResponseWriter, r *http.Request) {
	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.URL == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "url required"}, Meta: meta{RequestID: genID()}})
		return
	}

	id := genID()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec("INSERT INTO endpoints (id, url, secret, created_at) VALUES (?, ?, ?, ?)",
		id, req.URL, req.Secret, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"id": id, "url": fmt.Sprintf("https://webhook.tools.becklab.cloud/%s", id)}, Meta: meta{RequestID: genID()}})
}

func getEndpoint(w http.ResponseWriter, r *http.Request, id string) {
	var e endpoint
	err := db.QueryRow("SELECT id, url, secret, created_at FROM endpoints WHERE id = ?", id).Scan(&e.ID, &e.URL, &e.Secret, &e.CreatedAt)
	if err != nil {
		writeJSON(w, http.StatusNotFound, response{Status: "error", Result: map[string]string{"error": "not found"}, Meta: meta{RequestID: genID()}})
		return
	}
	writeJSON(w, http.StatusOK, response{Status: "success", Result: e, Meta: meta{RequestID: genID()}})
}

func deleteEndpoint(w http.ResponseWriter, r *http.Request, id string) {
	db.Exec("DELETE FROM endpoints WHERE id = ?", id)
	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"message": "deleted"}, Meta: meta{RequestID: genID()}})
}

func webhookIngestHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/webhook/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	// Verify HMAC signature if secret is set
	if r.Header.Get("X-Hub-Signature-256") != "" {
		var ep endpoint
		db.QueryRow("SELECT secret FROM endpoints WHERE id = ?", id).Scan(&ep.Secret)
		if ep.Secret != "" {
			signature := strings.TrimPrefix(r.Header.Get("X-Hub-Signature-256"), "sha256=")
			mac := hmac.New(sha256.New, []byte(ep.Secret))
			mac.Write(r.Body)
			if hex.EncodeToString(mac.Sum(nil)) != signature {
				http.Error(w, "signature mismatch", 401)
				return
			}
		}
	}

	payload, _ := os.ReadFile("/dev/stdin")
	if payload == nil {
		payload, _ = io.ReadAll(r.Body)
	}

	headersJSON, _ := json.Marshal(r.Header)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec("INSERT INTO deliveries (id, endpoint_id, payload, headers, attempts, status, created_at) VALUES (?, ?, ?, ?, 0, 'pending', ?)",
		genID(), id, string(payload), string(headersJSON), now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"message": "queued"}, Meta: meta{RequestID: genID()}})
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
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
	mux.HandleFunc("/api/v1/endpoints", endpointsHandler)
	mux.HandleFunc("/api/v1/endpoints/", endpointHandler)
	mux.HandleFunc("/api/v1/webhook/", webhookIngestHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	log.Printf("webhook-relay listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
