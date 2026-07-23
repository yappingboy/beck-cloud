package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

type dnsRequest struct {
	Domain   string `json:"domain"`
	RecordType string `json:"recordType"` // A, AAAA, MX, TXT, CNAME, NS, SOA
}

type dnsResponse struct {
	Status  string        `json:"status"`
	Result  []dnsRecord   `json:"result"`
	Meta    meta          `json:"meta"`
}

type dnsRecord struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	TTL     int    `json:"ttl"`
	Content string `json:"content"`
}

type healthCheckRequest struct {
	URL              string `json:"url"`
	ExpectedStatus   int    `json:"expectedStatus"`
	CheckIntervalSec int    `json:"checkIntervalSec"`
}

type tlsCheckRequest struct {
	Domain string `json:"domain"`
}

type tlsResult struct {
	CertIssuer string    `json:"issuer"`
	CertSubject string   `json:"subject"`
	ValidFrom    time.Time `json:"validFrom"`
	ValidUntil   time.Time `json:"validUntil"`
	DaysRemaining int     `json:"daysRemaining"`
	SANs         []string  `json:"sans"`
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

func dnsLookupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
		return
	}

	var req dnsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.Domain == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "domain required"}, Meta: meta{RequestID: genID()}})
		return
	}

	var records []dnsRecord
	var err error

	switch strings.ToUpper(req.RecordType) {
	case "A":
		ips, err := net.LookupIP(req.Domain)
		if err != nil {
			writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: []dnsRecord{}, Meta: meta{RequestID: genID()}})
			return
		}
		for _, ip := range ips {
			records = append(records, dnsRecord{Type: "A", Name: req.Domain, Content: ip.String()})
		}
	case "AAAA":
		ips, err := net.LookupIP(req.Domain)
		if err != nil {
			writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: []dnsRecord{}, Meta: meta{RequestID: genID()}})
			return
		}
		for _, ip := range ips {
			if ip.To4() == nil {
				records = append(records, dnsRecord{Type: "AAAA", Name: req.Domain, Content: ip.String()})
			}
		}
	case "MX":
		preferences, servers, err := net.LookupMX(req.Domain)
		if err != nil {
			writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: []dnsRecord{}, Meta: meta{RequestID: genID()}})
			return
		}
		for i, srv := range servers {
			records = append(records, dnsRecord{Type: "MX", Name: req.Domain, Content: fmt.Sprintf("%d %s", preferences[i], srv.Host)})
		}
	case "TXT":
		txts, _ := net.LookupTXT(req.Domain)
		for _, t := range txts {
			records = append(records, dnsRecord{Type: "TXT", Name: req.Domain, Content: t})
		}
	case "CNAME":
		target, _ := net.LookupCNAME(req.Domain)
		if target != "" {
			records = append(records, dnsRecord{Type: "CNAME", Name: req.Domain, Content: target})
		}
	case "NS":
		nameservers, _ := net.LookupNS(req.Domain)
		for _, ns := range nameservers {
			records = append(records, dnsRecord{Type: "NS", Name: req.Domain, Content: ns.Host})
		}
	case "SOA":
		soa, _ := net.LookupSOA(req.Domain)
		if len(soa) > 0 {
			s := soa[0]
			records = append(records, dnsRecord{Type: "SOA", Name: req.Domain, Content: fmt.Sprintf("%s %s %d %d %d %d %d", s.Ns, s.Mbox, s.Serial, s.Refresh, s.Retry, s.Expire, s.Minimum)})
		}
	default:
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": fmt.Sprintf("unknown record type: %s", req.RecordType)}, Meta: meta{RequestID: genID()}})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: records, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: records, Meta: meta{RequestID: genID()}})
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	var req healthCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(req.URL)
	status := "down"
	if err != nil {
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]interface{}{"url": req.URL, "status": status, "error": err.Error()}, Meta: meta{RequestID: genID()}})
		return
	}
	resp.Body.Close()

	status = "up"
	if req.ExpectedStatus > 0 && resp.StatusCode != req.ExpectedStatus {
		status = "mismatch"
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]interface{}{"url": req.URL, "status": status, "statusCode": resp.StatusCode}, Meta: meta{RequestID: genID()}})
}

func tlsCheckHandler(w http.ResponseWriter, r *http.Request) {
	var req tlsCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}

	conn, err := tls.Dial("tcp", req.Domain+":443", &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"error": err.Error(), "domain": req.Domain}, Meta: meta{RequestID: genID()}})
		return
	}
	defer conn.Close()

	cert := conn.ConnectionState().PeerCertificates[0]
	now := time.Now()
	daysRemaining := int(cert.NotAfter.Sub(now).Hours() / 24)

	sans := cert.DNSNames
	if len(cert.IPAddresses) > 0 {
		for _, ip := range cert.IPAddresses {
			if ipStr := ip.String(); ipStr != "" {
				sans = append(sans, ipStr)
			}
		}
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: tlsResult{
		CertIssuer: cert.Issuer.CommonName, CertSubject: cert.Subject.CommonName,
		ValidFrom: cert.NotBefore, ValidUntil: cert.NotAfter,
		DaysRemaining: daysRemaining, SANs: sans,
	}, Meta: meta{RequestID: genID()}})
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
	mux.HandleFunc("/api/v1/dns", dnsLookupHandler)
	mux.HandleFunc("/api/v1/healthcheck", healthCheckHandler)
	mux.HandleFunc("/api/v1/tls", tlsCheckHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	log.Printf("dns-monitor listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
