package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// --- Shared types ---

type APIRequest struct {
	RequestID string `json:"-"`
}

type APIResponse struct {
	Status string      `json:"status"`
	Result interface{} `json:"result"`
	Error  string      `json:"error,omitempty"`
	Meta   APIMeta     `json:"meta"`
}

type APIMeta struct {
	RequestID string `json:"requestId"`
	Timestamp string `json:"timestamp"`
}

type StatusCheck struct {
	Service string `json:"service"`
	Healthy bool   `json:"healthy"`
	Latency string `json:"latency,omitempty"`
}

type WorkflowDefinition struct {
	ID    string             `json:"id"`
	Name  string             `json:"name"`
	Steps []WorkflowStep     `json:"steps"`
}

type WorkflowStep struct {
	Service string            `json:"service"`
	Action  string            `json:"action"`
	Inputs  map[string]string `json:"inputs"`
}

type ExecutionResult struct {
	ID         string             `json:"id"`
	WorkflowID string             `json:"workflowId"`
	Status     string             `json:"status"`
	Steps      []StepResult       `json:"steps"`
	StartedAt  string             `json:"startedAt"`
	FinishedAt string             `json:"finishedAt"`
}

type StepResult struct {
	Step     int               `json:"step"`
	Service  string            `json:"service"`
	Action   string            `json:"action"`
	Status   string            `json:"status"`
	Result   interface{}       `json:"result,omitempty"`
	Error    string            `json:"error,omitempty"`
	Duration string            `json:"duration,omitempty"`
}

type APIKey struct {
	Key      string    `json:"key"`
	Name     string    `json:"name"`
	Active   bool      `json:"active"`
	Created  string    `json:"created"`
	LastUsed string    `json:"lastUsed,omitempty"`
}

type UsageStats struct {
	TotalRequests int64            `json:"totalRequests"`
	PerService    map[string]int64 `json:"perService"`
	PerDay        map[string]int64 `json:"perDay"`
}

// --- Utility ---

func genID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func genAPIKey() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "bf_" + hex.EncodeToString(b)
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Request-ID", genID())
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func proxyRequest(targetURL string, method string, body []byte) (*APIResponse, error) {
	var req *http.Request
	var err error
	if body != nil && len(body) > 0 {
		req, err = http.NewRequest(method, targetURL, bytes.NewReader(body))
	} else {
		req, err = http.NewRequest(method, targetURL, nil)
	}
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &APIResponse{
			Status: "error",
			Result: nil,
			Error:  fmt.Sprintf("proxy failed: %s", err.Error()),
			Meta: APIMeta{
				RequestID: genID(),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			},
		}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var result interface{}
	if len(respBody) > 0 {
		json.Unmarshal(respBody, &result)
	}

	return &APIResponse{
		Status: "success",
		Result: result,
		Meta: APIMeta{
			RequestID: genID(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}, nil
}

// --- Handlers ---

func statusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Status: "error", Error: "method not allowed", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	// Check all service health endpoints
	services := []string{"hasher", "url-shortener", "converter", "cron-jobs", "dns-monitor", "webhook-relay", "yaml-json-tool", "qr-generator", "image-editor-api"}
	var checks []StatusCheck

	for _, svc := range services {
		start := time.Now()
		// Try to reach each service through its K8s service name
		target := fmt.Sprintf("http://%s.micro.svc.cluster.local:80/healthz", svc)
		resp, err := http.Get(target)
		latency := time.Since(start).String()

		if err != nil || resp.StatusCode != 200 {
			checks = append(checks, StatusCheck{Service: svc, Healthy: false, Latency: latency})
			if resp != nil {
				resp.Body.Close()
			}
		} else {
			checks = append(checks, StatusCheck{Service: svc, Healthy: true, Latency: latency})
			resp.Body.Close()
		}
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Status: "success",
		Result: checks,
		Meta:   APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)},
	})
}

func hashHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://hasher.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func shortenerHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://url-shortener.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func converterHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://converter.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func qrHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://qr-generator.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func dnsHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://dns-monitor.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func cronHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://cron-jobs.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://webhook-relay.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

func yamlHandler(w http.ResponseWriter, r *http.Request) {
	target := "http://yaml-json-tool.micro.svc.cluster.local:80"
	result, _ := proxyRequest(target, r.Method, mustReadBody(r))
	writeJSON(w, 200, result)
}

// Execute workflow: chain steps through micro services
func executeWorkflow(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Status: "error", Error: "method not allowed", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	var req struct {
		WorkflowID string `json:"workflowId"`
	}
	body := mustReadBody(r)
	if len(body) > 0 {
		json.Unmarshal(body, &req)
	}

	def := getPrebuiltWorkflow(req.WorkflowID)
	if def == nil {
		writeJSON(w, http.StatusBadRequest, APIResponse{Status: "error", Error: "workflow not found", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	exec := ExecutionResult{
		ID:         genID(),
		WorkflowID: req.WorkflowID,
		Status:     "running",
		Steps:      []StepResult{},
		StartedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	var inputData interface{}

	for i, step := range def.Steps {
		start := time.Now()
		result, _ := proxyRequest(serviceURL(step.Service), step.Action, toJSON(map[string]interface{}{
			"data":    inputData,
			"options": step.Inputs,
		}))
		duration := time.Since(start).String()

		stepRes := StepResult{
			Step:     i + 1,
			Service:  step.Service,
			Action:   step.Action,
			Status:   "success",
			Duration: duration,
		}

		if result.Status == "success" {
			data, _ := json.Marshal(result.Result)
			json.Unmarshal(data, &inputData)
		} else {
			stepRes.Status = "error"
			stepRes.Error = result.Error
			exec.Status = "failed"
		}

		exec.Steps = append(exec.Steps, stepRes)
	}

	if exec.Status != "failed" {
		exec.Status = "success"
	}

	exec.FinishedAt = time.Now().UTC().Format(time.RFC3339)

	writeJSON(w, http.StatusOK, APIResponse{
		Status: "success",
		Result: exec,
		Meta:   APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)},
	})
}

func serviceURL(service string) string {
	return fmt.Sprintf("http://%s.micro.svc.cluster.local:80/api/v1", service)
}

func toJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func mustReadBody(r *http.Request) []byte {
	b, _ := io.ReadAll(r.Body)
	defer r.Body.Close()
	return b
}

// --- Pre-built workflows ---

var workflows = map[string]WorkflowDefinition{
	"scan-to-print": {
		ID:   "scan-to-print",
		Name: "Scan to Print-Ready",
		Steps: []WorkflowStep{
			{Service: "image-editor-api", Action: "POST /api/v1/editor/resize", Inputs: map[string]string{"width": "800", "height": "1200"}},
			{Service: "converter", Action: "POST /api/v1/encode", Inputs: map[string]string{"type": "base64"}},
			{Service: "hasher", Action: "POST /api/v1/hash", Inputs: map[string]string{"algorithm": "sha256"}},
			{Service: "qr-generator", Action: "POST /api/v1/qr", Inputs: map[string]string{"template": "none", "errorCorrection": "medium"}},
		},
	},
	"vcard-qr": {
		ID:   "vcard-qr",
		Name: "QR Business Card",
		Steps: []WorkflowStep{
			{Service: "qr-generator", Action: "POST /api/v1/qr", Inputs: map[string]string{"template": "vcard", "errorCorrection": "high"}},
			{Service: "hasher", Action: "POST /api/v1/hash", Inputs: map[string]string{"algorithm": "sha256"}},
			{Service: "url-shortener", Action: "POST /api/v1/shorten", Inputs: map[string]string{"custom": ""}},
		},
	},
	"deploy-check": {
		ID:   "deploy-check",
		Name: "Deploy Check",
		Steps: []WorkflowStep{
			{Service: "yaml-json-tool", Action: "POST /api/v1/yaml/validate", Inputs: map[string]string{}},
			{Service: "hasher", Action: "POST /api/v1/hash", Inputs: map[string]string{"algorithm": "sha256"}},
			{Service: "dns-monitor", Action: "POST /api/v1/dns/lookup", Inputs: map[string]string{"type": "A"}},
			{Service: "webhook-relay", Action: "POST /api/v1/webhook", Inputs: map[string]string{"endpoint": "slack"}},
		},
	},
}

func getPrebuiltWorkflow(id string) *WorkflowDefinition {
	w, ok := workflows[id]
	if !ok {
		return nil
	}
	return &w
}

func workflowListHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Status: "error", Error: "method not allowed", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	var list []WorkflowDefinition
	for _, w := range workflows {
		list = append(list, w)
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Status: "success",
		Result: list,
		Meta:   APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)},
	})
}

func randomStringHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Status: "error", Error: "method not allowed", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	length := 32
	q := r.URL.Query()
	if l := q.Get("length"); l != "" {
		fmt.Sscanf(l, "%d", &length)
		if length < 8 {
			length = 8
		}
		if length > 128 {
			length = 128
		}
	}

	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	s := make([]byte, length)
	for i := range s {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		s[i] = charset[n.Int64()]
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Status: "success",
		Result: map[string]interface{}{
			"string": string(s),
			"length": length,
			"base64": base64.StdEncoding.EncodeToString([]byte(string(s))),
			"sha256": hex.EncodeToString(sha256.Sum256([]byte(string(s)))),
		},
		Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)},
	})
}

func apiKeysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, APIResponse{Status: "error", Error: "method not allowed", Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)}})
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	body := mustReadBody(r)
	if len(body) > 0 {
		json.Unmarshal(body, &req)
	}

	key := genAPIKey()
	if req.Name == "" {
		req.Name = "unnamed"
	}

	writeJSON(w, http.StatusOK, APIResponse{
		Status: "success",
		Result: map[string]interface{}{
			"key":     key,
			"name":    req.Name,
			"created": time.Now().UTC().Format(time.RFC3339),
		},
		Meta: APIMeta{RequestID: genID(), Timestamp: time.Now().UTC().Format(time.RFC3339)},
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Proxy routes to micro services
	http.HandleFunc("/api/v1/hash", hashHandler)
	http.HandleFunc("/api/v1/shortener", shortenerHandler)
	http.HandleFunc("/api/v1/converter", converterHandler)
	http.HandleFunc("/api/v1/qr", qrHandler)
	http.HandleFunc("/api/v1/dns", dnsHandler)
	http.HandleFunc("/api/v1/cron", cronHandler)
	http.HandleFunc("/api/v1/webhook", webhookHandler)
	http.HandleFunc("/api/v1/yaml", yamlHandler)

	// BeckFlow-specific endpoints
	http.HandleFunc("/api/v1/status", statusHandler)
	http.HandleFunc("/api/v1/workflow", executeWorkflow)
	http.HandleFunc("/api/v1/workflows", workflowListHandler)
	http.HandleFunc("/api/v1/random", randomStringHandler)
	http.HandleFunc("/api/v1/apikeys", apiKeysHandler)

	// Health check
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	// Serve frontend from embedded filesystem or static dir
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "/app/frontend"
	}
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	log.Printf("beckflow listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
