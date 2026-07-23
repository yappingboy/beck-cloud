package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	qr "github.com/skip2/go-qrcode"
)

type request struct {
	Data               string `json:"data"`
	Format             string `json:"format"` // png, svg
	ErrorCorrection    string `json:"errorCorrection"` // L, M, Q, H
	Size               int    `json:"size"`
	Template           string `json:"template"` // none, wifi, vcard, email, sms, geo
	WifiSSID           string `json:"wifiSSID,omitempty"`
	WifiPassword       string `json:"wifiPassword,omitempty"`
	WifiEncryption     string `json:"wifiEncryption,omitempty"`
	VCardName          string `json:"vcardName,omitempty"`
	VCardEmail         string `json:"vcardEmail,omitempty"`
	VCardPhone         string `json:"vcardPhone,omitempty"`
	EmailSubject       string `json:"emailSubject,omitempty"`
	EmailBody          string `json:"emailBody,omitempty"`
	SMSBody            string `json:"smsBody,omitempty"`
	GeoLat             string `json:"geoLat,omitempty"`
	GeoLng             string `json:"geoLng,omitempty"`
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
	return fmt.Sprintf("%d", 0)
}

func buildQRData(req *request) string {
	switch strings.ToLower(req.Template) {
	case "wifi":
		return fmt.Sprintf("WIFI:T:%s;S:%s;P:%s;;",
			strings.ToUpper(req.WifiEncryption), req.WifiSSID, req.WifiPassword)
	case "vcard":
		return fmt.Sprintf("BEGIN:VCARD\nVERSION:3.0\nFN:%s\nEMAIL:%s\nTEL:%s\nEND:VCARD",
			req.VCardName, req.VCardEmail, req.VCardPhone)
	case "email":
		return fmt.Sprintf("mailto:%s?subject=%s&body=%s", req.Data, req.EmailSubject, req.EmailBody)
	case "sms":
		return fmt.Sprintf("sms:?body=%s", req.SMSBody)
	case "geo":
		return fmt.Sprintf("geo:%s,%s", req.GeoLat, req.GeoLng)
	default:
		return req.Data
	}
}

func generateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
		return
	}

	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.Data == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "data required"}, Meta: meta{RequestID: genID()}})
		return
	}

	data := buildQRData(&req)
	ecLevel := qr.Medium
	switch strings.ToUpper(req.ErrorCorrection) {
	case "LOW":
		ecLevel = qr.Low
	case "MEDIUM":
		ecLevel = qr.Medium
	case "QUARTILE":
		ecLevel = qr.Quartile
	case "HIGH":
		ecLevel = qr.High
	default:
		ecLevel = qr.Medium
	}

	size := 300
	if req.Size > 0 && req.Size <= 4000 {
		size = req.Size
	}

	qrCode, err := qr.New(data, ecLevel)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": err.Error()}, Meta: meta{RequestID: genID()}})
		return
	}

	format := strings.ToLower(req.Format)
	if format == "" {
		format = "png"
	}

	w.Header().Set("Content-Type", "image/png")
	if format == "svg" {
		w.Header().Set("Content-Type", "image/svg+xml")
		svg := qrCode.ToSVG(size)
		io.WriteString(w, svg)
		return
	}

	// PNG output
	var buf bytes.Buffer
	img, err := qrCode.PNG(size)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "png generation failed"}, Meta: meta{RequestID: genID()}})
		return
	}
	if err := png.Encode(&buf, img); err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "png encode failed"}, Meta: meta{RequestID: genID()}})
		return
	}

	w.Header().Set("X-QR-Size", fmt.Sprintf("%d", buf.Len()))
	w.Write(buf.Bytes())
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

	http.HandleFunc("/api/v1/qr", generateHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	log.Printf("qr-generator listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
