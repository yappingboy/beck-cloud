package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	ieRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "micro", Subsystem: "image_editor", Name: "http_requests_total", Help: "Total HTTP requests.",
	}, []string{"method", "status"})
	ieDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "micro", Subsystem: "image_editor", Name: "http_request_duration_seconds", Help: "Request duration.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
	}, []string{"method", "endpoint"})
	ieActive = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "micro", Subsystem: "image_editor", Name: "http_active_requests", Help: "Active requests.",
	})
)

func ieWrap(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t := time.Now(); ieActive.Inc(); defer ieActive.Dec()
		sw := &ieSW{w, http.StatusOK}; h(sw, r)
		ieRequests.WithLabelValues(r.Method, fmt.Sprintf("%d", sw.c)).Inc()
		ieDuration.WithLabelValues(r.Method, r.URL.Path).Observe(time.Since(t).Seconds())
	}
}
type ieSW struct{ http.ResponseWriter; c int }
func (s *ieSW) WriteHeader(code int) { s.c = code; s.ResponseWriter.WriteHeader(code) }

type saveRequest struct {
	Data   string `json:"data"`
	Format string `json:"format"`
	Name   string `json:"name,omitempty"`
}

type response struct {
	Status string      `json:"status"`
	Result interface{} `json:"result"`
	Meta   meta       `json:"meta"`
}

type meta struct {
	RequestID string `json:"requestId"`
}

func genID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func saveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
		return
	}

	var req saveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}

	_, err := base64.StdEncoding.DecodeString(req.Data)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid base64 data"}, Meta: meta{RequestID: genID()}})
		return
	}

	name := req.Name
	if name == "" {
		name = fmt.Sprintf("image_%d.png", time.Now().Unix())
	}

	saveDir := "/data/images"
	os.MkdirAll(saveDir, 0755)
	filePath := saveDir + "/" + name
	if err := os.WriteFile(filePath, []byte(req.Data), 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "save failed"}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"path": filePath, "name": name}, Meta: meta{RequestID: genID()}})
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/editor/save", ieWrap(saveHandler))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.Handle("/metrics", promhttp.Handler())

	log.Printf("image-editor-api listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
