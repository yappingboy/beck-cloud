package main

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
)

type request struct {
	Operation string `json:"operation"`
	Input     string `json:"input"`
	Option    string `json:"option,omitempty"`
	Length    int    `json:"length,omitempty"`
}

type response struct {
	Status string      `json:"status"`
	Result interface{} `json:"result"`
	Meta   meta       `json:"meta"`
}

type meta struct {
	RequestID string `json:"requestId"`
}

func convertHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
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

	var result string
	var err error

	switch strings.ToLower(req.Operation) {
	case "base64_encode":
		result = base64.StdEncoding.EncodeToString([]byte(req.Input))
	case "base64_decode":
		result, err = base64Decode(req.Input)
	case "url_encode":
		result = urlEncode(req.Input)
	case "url_decode":
		result, err = urlDecode(req.Input)
	case "html_encode":
		result = htmlEncode(req.Input)
	case "html_decode":
		result = htmlDecode(req.Input)
	case "hex_encode":
		result = hex.EncodeToString([]byte(req.Input))
	case "hex_decode":
		result, err = hex.DecodeString(req.Input)
	case "rot13":
		result = rot13(req.Input)
	case "uuid_v4":
		result = uuid.New().String()
	case "random_string":
		length := req.Length
		if length <= 0 {
			length = 32
		}
		result = randomString(length)
	case "ascii_to_hex":
		result = hex.EncodeToString([]byte(req.Input))
	case "hex_to_ascii":
		result, err = hex.DecodeString(req.Input)
	default:
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": fmt.Sprintf("unknown operation: %s", req.Operation)}, Meta: meta{RequestID: genID()}})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": err.Error()}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{
		Status: "success",
		Result: map[string]string{"result": result},
		Meta:   meta{RequestID: genID()},
	})
}

func base64Decode(s string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func urlEncode(s string) string {
	return base64.URLEncoding.EncodeToString([]byte(s))
}

func urlDecode(s string) (string, error) {
	decoded, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func htmlEncode(s string) string {
	result := strings.ReplaceAll(s, "&", "&amp;")
	result = strings.ReplaceAll(result, "<", "&lt;")
	result = strings.ReplaceAll(result, ">", "&gt;")
	result = strings.ReplaceAll(result, "\"", "&quot;")
	result = strings.ReplaceAll(result, "'", "&#39;")
	return result
}

func htmlDecode(s string) string {
	result := strings.ReplaceAll(s, "&amp;", "&")
	result = strings.ReplaceAll(result, "&lt;", "<")
	result = strings.ReplaceAll(result, "&gt;", ">")
	result = strings.ReplaceAll(result, "&quot;", "\"")
	result = strings.ReplaceAll(result, "&#39;", "'")
	return result
}

func rot13(s string) string {
	runes := []rune(s)
	for i, r := range runes {
		switch {
		case r >= 'a' && r <= 'z':
			runes[i] = 'a' + (r-'a'+13)%26
		case r >= 'A' && r <= 'Z':
			runes[i] = 'A' + (r-'A'+13)%26
		}
	}
	return string(runes)
}

func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[int(os.Getpid())%len(charset)+i%len(charset)]
	}
	return string(result)
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
	log.Printf("converter listening on :%s", port)
	http.HandleFunc("/api/v1/convert", convertHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	http.ListenAndServe(":"+port, nil)
}
