package main

import (
	"crypto/md5"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
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
	log.Printf("hasher listening on :%s", port)
	http.HandleFunc("/api/v1/hash", hashHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	http.ListenAndServe(":"+port, nil)
}
