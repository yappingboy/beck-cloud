package main

import (
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "micro",
		Subsystem: "hasher",
		Name:      "http_requests_total",
		Help:      "Total HTTP requests by method and status.",
	}, []string{"method", "status"})
	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "micro",
		Subsystem: "hasher",
		Name:      "http_request_duration_seconds",
		Help:      "HTTP request duration in seconds.",
		Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
	}, []string{"method", "endpoint"})
	activeRequests = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "micro",
		Subsystem: "hasher",
		Name:      "http_active_requests",
		Help:      "Currently active HTTP requests.",
	})
)

type request struct {
	Algo   string `json:"algo"`
	Input  string `json:"input"`
	Key    string `json:"key,omitempty"`
	Option string `json:"option,omitempty"`
}

type response struct {
	Status string      `json:"status"`
	Result interface{} `json:"result"`
	Meta   meta       `json:"meta"`
}

type meta struct {
	RequestID string `json:"requestId"`
}

func metricsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		activeRequests.Inc()
		defer activeRequests.Dec()

		// Wrap ResponseWriter to capture status code
		wrapped := &statusCapture{ResponseWriter: w, status: http.StatusOK}
		next(wrapped, r)

		duration := time.Since(start).Seconds()
		requestTotal.WithLabelValues(r.Method, fmt.Sprintf("%d", wrapped.status)).Inc()
		requestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration)
	}
}

type statusCapture struct {
	http.ResponseWriter
	status int
}

func (s *statusCapture) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func hashHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		fmt.Fprintf(w, `{"status":"error","result":{"error":"method not allowed"},"meta":{"requestId":""}}`)
		return
	}

	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}

	if req.Input == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "input required"}, Meta: meta{RequestID: genID()}})
		return
	}

	result := ""
	switch strings.ToLower(req.Algo) {
	case "sha256":
		h := sha256.Sum256([]byte(req.Input))
		result = hex.EncodeToString(h[:])
	case "sha512":
		h := sha512.Sum512([]byte(req.Input))
		result = hex.EncodeToString(h[:])
	case "sha256-hmac":
		if req.Key == "" {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "key required for hmac"}, Meta: meta{RequestID: genID()}})
			return
		}
		mac := hmac.New(sha256.New, []byte(req.Key))
		mac.Write([]byte(req.Input))
		result = hex.EncodeToString(mac.Sum(nil))
	case "md5":
		h := md5.Sum([]byte(req.Input))
		result = hex.EncodeToString(h[:])
	case "base64_encode":
		result = base64.StdEncoding.EncodeToString([]byte(req.Input))
	case "base64_decode":
		decoded, err := base64.StdEncoding.DecodeString(req.Input)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid base64 input"}, Meta: meta{RequestID: genID()}})
			return
		}
		result = string(decoded)
	case "hex_encode":
		result = hex.EncodeToString([]byte(req.Input))
	case "hex_decode":
		decoded, err := hex.DecodeString(req.Input)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid hex input"}, Meta: meta{RequestID: genID()}})
			return
		}
		result = string(decoded)
	default:
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": fmt.Sprintf("unknown algo: %s", req.Algo)}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{
		Status: "success",
		Result: map[string]string{"hash": result},
		Meta:   meta{RequestID: genID()},
	})
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func genID() string { return uuid.New().String() }

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/hash", metricsMiddleware(hashHandler))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.Handle("/metrics", promhttp.Handler())

	log.Printf("hasher listening on :%s", port)
	http.ListenAndServe(":"+port, mux)
}
