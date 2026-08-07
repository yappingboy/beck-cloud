package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	dnsRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "micro", Subsystem: "dns_monitor", Name: "http_requests_total", Help: "Total HTTP requests.",
	}, []string{"method", "status"})
	dnsDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "micro", Subsystem: "dns_monitor", Name: "http_request_duration_seconds", Help: "Request duration.",
		Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
	}, []string{"method", "endpoint"})
	dnsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "micro", Subsystem: "dns_monitor", Name: "http_active_requests", Help: "Active requests.",
	})
)

func dnsWrap(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t := time.Now(); dnsActive.Inc(); defer dnsActive.Dec()
		sw := &dnsSW{w, http.StatusOK}; h(sw, r)
		dnsRequests.WithLabelValues(r.Method, fmt.Sprintf("%d", sw.c)).Inc()
		dnsDuration.WithLabelValues(r.Method, r.URL.Path).Observe(time.Since(t).Seconds())
	}
}
type dnsSW struct{ http.ResponseWriter; c int }
func (s *dnsSW) WriteHeader(code int) { s.c = code; s.ResponseWriter.WriteHeader(code) }

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
		servers, err := net.LookupMX(req.Domain)
		if err != nil {
			writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: []dnsRecord{}, Meta: meta{RequestID: genID()}})
			return
		}
		for _, srv := range servers {
			parts := strings.SplitN(srv, " ", 2)
			if len(parts) == 2 {
				records = append(records, dnsRecord{Type: "MX", Name: req.Domain, Content: parts[0] + " " + parts[1]})
			}
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
	case "SOA":
		r := &net.Resolver{}
		soas, err := r.LookupSOA(context.Background(), req.Domain)
		if err == nil {
			for _, soa := range soas {
				records = append(records, dnsRecord{Type: "SOA", Name: req.Domain, Content: fmt.Sprintf("%s %s %d %d %d %d %d", soa.Ns, soa.Mbox, soa.Serial, soa.Refresh, soa.Retry, soa.Expire, soa.Minimum)})
			}
		}


	writeJSON(w, http.StatusOK, dnsResponse{Status: "success", Result: records, Meta: meta{RequestID: genID()}})
}

	conn, err := tls.Dial("tcp", req.Domain+":443", &tls.Config{InsecureSkipVerify: true})
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
	expiry := cert.NotAfter
	now := time.Now()
	if expiry.Before(now) {
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]interface{}{"domain": req.Domain, "tls": true, "expired": true, "expiry": expiry.Format(time.RFC3339)}, Meta: meta{RequestID: genID()}})
		return
	}
	daysLeft := int(expiry.Sub(now).Hours() / 24)
	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]interface{}{"domain": req.Domain, "tls": true, "expired": false, "expiry": expiry.Format(time.RFC3339), "daysUntilExpiry": daysLeft}, Meta: meta{RequestID: genID()}})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/dns", dnsWrap(dnsLookupHandler))
	mux.HandleFunc("/api/v1/healthcheck", dnsWrap(healthCheckHandler))
	mux.HandleFunc("/api/v1/tls", dnsWrap(tlsCheckHandler))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	mux.Handle("/metrics", promhttp.Handler())

	log.Printf("dns-monitor listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
