package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================
// BeckCloud Admin Panel API
// Go backend: Directus + Keycloak + K8s + Redis
// ============================================================

// ---- Config ----

type config struct {
	directusURL   string
	directusEmail string
	directusPass  string
	keycloakURL   string
	k8sAPI        string
	redisHost     string
	redisPort     int
	redisPass     string
	port          string
	lldapURL      string
	lldapAdminUser string
	lldapAdminPass string
	lldapToken     string
	lldapTokenTTL  int // seconds before refresh
}

var cfg config
var adminToken string // Directus admin JWT
var tokenExpiry time.Time
var tokenMu sync.Mutex

// ---- Directus Auth ----

func getDirectusToken() (string, error) {
	tokenMu.Lock()
	defer tokenMu.Unlock()

	if adminToken != "" && time.Now().Before(tokenExpiry) {
		return adminToken, nil
	}

	url := cfg.directusURL + "/admin/auth/login/v2"
	payload := map[string]string{
		"identifier": cfg.directusEmail,
		"password":   cfg.directusPass,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("directus auth failed: %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.Data.Token == "" {
		return "", fmt.Errorf("no token in response")
	}

	adminToken = result.Data.Token
	// Token valid for 1 year - set expiry to 23h to be safe
	tokenExpiry = time.Now().Add(23 * time.Hour)
	return adminToken, nil
}

// ---- Directus API Helpers ----

func directusGet(path string) ([]byte, error) {
	token, err := getDirectusToken()
	if err != nil {
		return nil, err
	}

	url := cfg.directusURL + path
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("directus %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func directusPost(path string, body interface{}) ([]byte, error) {
	token, err := getDirectusToken()
	if err != nil {
		return nil, err
	}

	data, _ := json.Marshal(body)
	url := cfg.directusURL + path
	req, err := http.NewRequest("POST", url, strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("directus %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func directusPatch(path string, body interface{}) ([]byte, error) {
	token, err := getDirectusToken()
	if err != nil {
		return nil, err
	}

	data, _ := json.Marshal(body)
	url := cfg.directusURL + path
	req, err := http.NewRequest("PATCH", url, strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("directus %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func directusDelete(path string) ([]byte, error) {
	token, err := getDirectusToken()
	if err != nil {
		return nil, err
	}

	url := cfg.directusURL + path
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("directus %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// ---- K8s API Helpers ----

func k8sGet(path string) ([]byte, error) {
	caCert := os.Getenv("K8S_CA_CERT")
	token := os.Getenv("K8S_TOKEN")
	if caCert == "" {
		if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"); err == nil {
			caCert = string(data)
		}
	}
	if token == "" {
		if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token"); err == nil {
			token = strings.TrimSpace(string(data))
		}
	}

	if caCert == "" || token == "" {
		return nil, fmt.Errorf("K8s credentials not available")
	}

	url := cfg.k8sAPI + path
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: tr, Timeout: 15 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("k8s %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// ---- Redis Helper ----

func redisCmd(cmd ...string) ([]interface{}, error) {
	url := fmt.Sprintf("http://%s:%d", cfg.redisHost, cfg.redisPort)
	payload := map[string]interface{}{
		"cmd": cmd,
	}
	data, _ := json.Marshal(payload)

	resp, err := http.Post(url+"/command", "application/json", strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("redis %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data []interface{} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Data, nil
}

// ---- Keycloak Helpers ----

func kcGet(path string) ([]byte, error) {
	clientID := os.Getenv("KC_CLIENT_ID")
	clientSecret := os.Getenv("KC_CLIENT_SECRET")
	_ = os.Getenv("KC_USERNAME")
	_ = os.Getenv("KC_PASSWORD")

	tokenURL := cfg.keycloakURL + "/realms/homelab/protocol/openid-connect/token"
	payload := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", clientID, clientSecret)

	resp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var kcToken struct {
		AccessToken string `json:"access_token"`
	}
	json.NewDecoder(resp.Body).Decode(&kcToken)

	resp2, err := http.Get(cfg.keycloakURL + path)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()

	return io.ReadAll(resp2.Body)
}

// ---- Request Body Helper ----

func readBody(w http.ResponseWriter, r *http.Request) ([]byte, interface{}) {
	if r.Method != "POST" && r.Method != "PATCH" && r.Method != "PUT" {
		return nil, nil
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "failed to read body"})
		return nil, nil
	}

	var parsed interface{}
	if err := json.Unmarshal(body, &parsed); err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
		return nil, nil
	}

	return body, parsed
}

// ---- Route Handlers ----

func handleDashboardSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	result := map[string]interface{}{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	// Pod counts
	nsData, err := k8sGet("/api/v1/namespaces")
	if err == nil {
		var nsList struct {
			Items []struct {
				Metadata struct {
					Name string `json:"name"`
				} `json:"metadata"`
			} `json:"items"`
		}
		json.Unmarshal(nsData, &nsList)

		totalPods := 0
		readyPods := 0
		pendingPods := 0
		crashLoop := 0

		for _, ns := range nsList.Items {
			podsData, err := k8sGet("/api/v1/namespaces/" + ns.Metadata.Name + "/pods")
			if err != nil {
				continue
			}
			var pods struct {
				Items []struct {
					Status struct {
						Phase string `json:"phase"`
						ContainerStatuses []struct {
							State struct {
								Waiting *struct {
									Reason string `json:"reason"`
								} `json:"waiting"`
							} `json:"state"`
						} `json:"containerStatuses"`
					} `json:"status"`
				} `json:"items"`
			}
			json.Unmarshal(podsData, &pods)

			for _, p := range pods.Items {
				totalPods++
				switch p.Status.Phase {
				case "Running":
					readyPods++
				case "Pending":
					pendingPods++
				}
				for _, cs := range p.Status.ContainerStatuses {
					if cs.State.Waiting != nil && cs.State.Waiting.Reason == "CrashLoopBackOff" {
						crashLoop++
					}
				}
			}
		}

		result["namespaces"] = len(nsList.Items)
		result["pods"] = map[string]int{
			"total":     totalPods,
			"ready":     readyPods,
			"pending":   pendingPods,
			"crashLoop": crashLoop,
		}
	}

	// Cert counts
	certData, err := k8sGet("/apis/cert-manager.io/v1/namespaces")
	if err == nil {
		var certList struct {
			Items []struct {
				Status struct {
					Conditions []struct {
						Type    string `json:"type"`
						Status  string `json:"status"`
					} `json:"conditions"`
				} `json:"status"`
			} `json:"items"`
		}
		json.Unmarshal(certData, &certList)

		certReady := 0
		for _, c := range certList.Items {
			for _, cond := range c.Status.Conditions {
				if cond.Type == "Ready" && cond.Status == "True" {
					certReady++
				}
			}
		}
		result["certs"] = map[string]int{
			"ready": certReady,
			"total": len(certList.Items),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleHealthPods(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	nsData, err := k8sGet("/api/v1/namespaces")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var nsList struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"items"`
	}
	json.Unmarshal(nsData, &nsList)

	var services []map[string]interface{}
	for _, ns := range nsList.Items {
		podsData, err := k8sGet("/api/v1/namespaces/" + ns.Metadata.Name + "/pods")
		if err != nil {
			continue
		}
		var pods struct {
			Items []struct {
				Metadata struct {
					Name        string            `json:"name"`
					Labels      map[string]string `json:"labels"`
					OwnerRefs   []struct {
						Kind string `json:"kind"`
						Name string `json:"name"`
					} `json:"ownerReferences"`
				} `json:"metadata"`
				Status struct {
					Phase string `json:"phase"`
				} `json:"status"`
			} `json:"items"`
		}
		json.Unmarshal(podsData, &pods)

		groups := map[string]*struct {
			Running int
			Total   int
		}{}

		for _, p := range pods.Items {
			owner := "standalone"
			for _, ref := range p.Metadata.OwnerRefs {
				if ref.Kind == "ReplicaSet" || ref.Kind == "Deployment" || ref.Kind == "StatefulSet" {
					owner = ref.Name
					break
				}
			}
			if groups[owner] == nil {
				groups[owner] = &struct {
					Running int
					Total   int
				}{}
			}
			groups[owner].Total++
			if p.Status.Phase == "Running" {
				groups[owner].Running++
			}
		}

		for name, g := range groups {
			healthy := g.Running == g.Total && g.Total > 0
			services = append(services, map[string]interface{}{
				"namespace": ns.Metadata.Name,
				"name":      name,
				"ready":     g.Running,
				"total":     g.Total,
				"healthy":   healthy,
				"phase":     func() string {
					if g.Total == 0 {
						return "no-pods"
					}
					if g.Running == g.Total {
						return "healthy"
					}
					return "degraded"
				}(),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func handleUsersList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	path := "/admin/collections/bc_users/items?fields=*,keycloak_uuid&meta=total_count&page=1&limit=100"
	data, err := directusGet(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var result struct {
		Data []map[string]interface{} `json:"data"`
		Meta  struct {
			TotalCount int `json:"total_count"`
		} `json:"meta"`
	}
	json.Unmarshal(data, &result)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":     result.Data,
		"total":    result.Meta.TotalCount,
	})
}

func handleUsersCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	_, body := readBody(w, r)
	if body == nil {
		return
	}

	data, err := directusPost("/admin/collections/bc_users/items", body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// Log to audit
	logAudit(w, "user", "created", body.(map[string]interface{})["email"].(string))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	w.Write(data)
}

func handleUserUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PATCH" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	itemID := pathParts[len(pathParts)-1]

	_, body := readBody(w, r)
	if body == nil {
		return
	}

	data, err := directusPatch("/admin/collections/bc_users/items/"+itemID, body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "user", "updated", itemID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleUserDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	itemID := pathParts[len(pathParts)-1]

	data, err := directusDelete("/admin/collections/bc_users/items/" + itemID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "user", "deleted", itemID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleTicketsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	path := "/admin/collections/bc_tickets/items?fields=*,user_email,service&sort=-created_at&page=1&limit=100"
	if filter := r.URL.Query().Get("status"); filter != "" {
		path = fmt.Sprintf("/admin/collections/bc_tickets/items?filter[status][eq]=%s&fields=*,user_email,service&sort=-created_at&page=1&limit=100", filter)
	}

	data, err := directusGet(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleTicketsCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	_, body := readBody(w, r)
	if body == nil {
		return
	}

	data, err := directusPost("/admin/collections/bc_tickets/items", body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "ticket", "created", body.(map[string]interface{})["title"])

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	w.Write(data)
}

func handleTicketUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PATCH" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	itemID := pathParts[len(pathParts)-1]

	_, body := readBody(w, r)
	if body == nil {
		return
	}

	data, err := directusPatch("/admin/collections/bc_tickets/items/"+itemID, body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "ticket", "updated", itemID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleTicketDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	itemID := pathParts[len(pathParts)-1]

	data, err := directusDelete("/admin/collections/bc_tickets/items/" + itemID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "ticket", "deleted", itemID)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleAuditLogList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	path := "/admin/collections/bc_audit_log/items?fields=*&sort=-timestamp&page=1&limit=100"
	if filter := r.URL.Query().Get("type"); filter != "" && filter != "all" {
		path = fmt.Sprintf("/admin/collections/bc_audit_log/items?filter[type][eq]=%s&fields=*&sort=-timestamp&page=1&limit=100", filter)
	}

	data, err := directusGet(path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func logAudit(w http.ResponseWriter, entryType, action, target interface{}) {
	payload := map[string]interface{}{
		"type":    entryType,
		"action":  action,
		"target":  target,
		"ip":      "127.0.0.1",
	}

	_, _ = directusPost("/admin/collections/bc_audit_log/items", payload)
}

func handleBackupStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	data, err := k8sGet("/apis/velero.io/v1/namespaces/velero/backups")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var result struct {
		Items []struct {
			Metadata struct {
				Name        string    `json:"name"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
				Labels      map[string]string `json:"labels"`
			} `json:"metadata"`
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
			Spec struct {
				TTLMinutes          int      `json:"ttlMinutes"`
				IncludedNamespaces  []string `json:"includedNamespaces"`
			} `json:"spec"`
		} `json:"items"`
	}
	json.Unmarshal(data, &result)

	// Sort by creation time descending
	sorted := result.Items
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Metadata.CreationTimestamp.After(sorted[i].Metadata.CreationTimestamp) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sorted[:min(len(sorted), 20)])
}

func handleBackupRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}

	backupName := "manual-" + time.Now().Format("20060102-150405")
	backup := map[string]interface{}{
		"apiVersion": "velero.io/v1",
		"kind":       "Backup",
		"metadata": map[string]interface{}{
			"name":      backupName,
			"namespace": "velero",
			"labels": map[string]string{
				"admin-panel": "manual-backup",
			},
		},
		"spec": map[string]interface{}{
			"includedNamespaces":  []string{"*"},
			"storageLocation":     "default",
			"ttlMinutes":          float64(720 * 24), // 30 days
		},
	}

	data, err := k8sPost("/apis/velero.io/v1/namespaces/velero/backups", backup)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "system", "backup", backupName)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func k8sPost(path string, body interface{}) ([]byte, error) {
	caCert := os.Getenv("K8S_CA_CERT")
	token := os.Getenv("K8S_TOKEN")
	if caCert == "" {
		if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"); err == nil {
			caCert = string(data)
		}
	}
	if token == "" {
		if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token"); err == nil {
			token = strings.TrimSpace(string(data))
		}
	}

	if caCert == "" || token == "" {
		return nil, fmt.Errorf("K8s credentials not available")
	}

	data, _ := json.Marshal(body)
	url := cfg.k8sAPI + path

	req, err := http.NewRequest("POST", url, strings.NewReader(string(data)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: tr, Timeout: 30 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("k8s %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func handleRedisFlush(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}

	_, err := redisCmd("FLUSHDB")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "system", "redis-flush", "")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"ok": "redis flushed"})
}

func handleCerts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	nsData, err := k8sGet("/api/v1/namespaces")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var nsList struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"items"`
	}
	json.Unmarshal(nsData, &nsList)

	var certs []map[string]interface{}
	for _, ns := range nsList.Items {
		if ns.Metadata.Name == "kube-system" || ns.Metadata.Name == "kube-public" {
			continue
		}
		certData, err := k8sGet("/apis/cert-manager.io/v1/namespaces/" + ns.Metadata.Name + "/certificates")
		if err != nil {
			continue
		}
		var certList struct {
			Items []struct {
				Metadata struct {
					Name string `json:"name"`
				} `json:"metadata"`
				Spec struct {
					DNSNames []string `json:"dnsNames"`
					SecretName string `json:"secretName"`
				} `json:"spec"`
				Status struct {
					Conditions []struct {
						Type   string `json:"type"`
						Status string `json:"status"`
					} `json:"conditions"`
				} `json:"status"`
			} `json:"items"`
		}
		json.Unmarshal(certData, &certList)

		for _, c := range certList.Items {
			ready := false
			for _, cond := range c.Status.Conditions {
				if cond.Type == "Ready" && cond.Status == "True" {
					ready = true
				}
			}
			certs = append(certs, map[string]interface{}{
				"name":      c.Metadata.Name,
				"namespace": ns.Metadata.Name,
				"domains":   c.Spec.DNSNames,
				"secret":    c.Spec.SecretName,
				"ready":     ready,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(certs)
}

func handleKeycloakUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	url := cfg.keycloakURL + "/admin/realms/homelab/users?max=200"

	clientID := os.Getenv("KC_CLIENT_ID")
	clientSecret := os.Getenv("KC_CLIENT_SECRET")

	tokenURL := cfg.keycloakURL + "/realms/homelab/protocol/openid-connect/token"
	tokenPayload := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", clientID, clientSecret)

	tokenResp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(tokenPayload))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer tokenResp.Body.Close()

	var kcToken struct {
		AccessToken string `json:"access_token"`
	}
	json.NewDecoder(tokenResp.Body).Decode(&kcToken)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Authorization", "Bearer "+kcToken.AccessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		w.Write(respBody)
		return
	}

	respBody, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.Write(respBody)
}

// ---- Router ----

func router(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(r.URL.Path, "/")

	// Health check
	if path == "health" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	// API routes
	if strings.HasPrefix(path, "api/") {
		apiPath := strings.TrimPrefix(path, "api/")

		switch {
		// Dashboard
		case apiPath == "dashboard/summary":
			handleDashboardSummary(w, r)
			return

		// Health
		case apiPath == "health/pods":
			handleHealthPods(w, r)
			return
		case apiPath == "certs":
			handleCerts(w, r)
			return

		// Users
		case apiPath == "users/directus":
			handleUsersList(w, r)
			return
		case strings.HasPrefix(apiPath, "users/directus/") && strings.HasSuffix(apiPath, "/items"):
			_ = strings.TrimPrefix(apiPath, "users/directus/")
			if r.Method == "POST" {
				handleUsersCreate(w, r)
				return
			}
			if r.Method == "PATCH" {
				handleUserUpdate(w, r)
				return
			}
			if r.Method == "DELETE" {
				handleUserDelete(w, r)
				return
			}

		// Keycloak users
		case apiPath == "users/keycloak":
			handleKeycloakUsers(w, r)
			return

		// Tickets
		case apiPath == "tickets":
			handleTicketsList(w, r)
			return
		case apiPath == "tickets" && r.Method == "POST":
			handleTicketsCreate(w, r)
			return
		case strings.HasPrefix(apiPath, "tickets/") && strings.HasSuffix(apiPath, "/items"):
			if r.Method == "PATCH" {
				handleTicketUpdate(w, r)
				return
			}
			if r.Method == "DELETE" {
				handleTicketDelete(w, r)
				return
			}

		// Audit log
		case apiPath == "audit":
			handleAuditLogList(w, r)
			return

		// Backups
		case apiPath == "backup/status":
			handleBackupStatus(w, r)
			return
		case apiPath == "backup/run":
			handleBackupRun(w, r)
			return

		// Redis
		case apiPath == "redis/flush":
			handleRedisFlush(w, r)
			return

		// LLDAP users
		case apiPath == "users/lldap" && (r.Method == "GET" || r.Method == "POST"):
			if r.Method == "GET" {
				handleLLDAPUsersList(w, r)
			} else {
				handleLLDAPUsersCreate(w, r)
			}
			return
		case strings.HasPrefix(apiPath, "users/lldap/") && (r.Method == "PATCH" || r.Method == "DELETE"):
			if r.Method == "PATCH" {
				handleLLDAPUserUpdate(w, r)
			} else {
				handleLLDAPUserDelete(w, r)
			}
			return

		// LLDAP groups
		case apiPath == "groups/lldap" && (r.Method == "GET" || r.Method == "POST"):
			if r.Method == "GET" {
				handleLLDAPGroupsList(w, r)
			} else {
				handleLLDAPGroupsCreate(w, r)
			}
			return
		case strings.HasPrefix(apiPath, "groups/lldap/") && (r.Method == "PATCH" || r.Method == "DELETE"):
			if r.Method == "PATCH" {
				handleLLDAPGroupUpdate(w, r)
			} else {
				handleLLDAPGroupDelete(w, r)
			}
			return
		case strings.HasPrefix(apiPath, "groups/lldap/") && strings.Contains(apiPath, "/users/") && r.Method == "POST":
			handleLLDAPAddUserToGroup(w, r)
			return
		case strings.HasPrefix(apiPath, "groups/lldap/") && strings.Contains(apiPath, "/users/") && r.Method == "DELETE":
			handleLLDAPRemoveUserFromGroup(w, r)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "route not found", "path": apiPath})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
}

// ---- LLDAP Helpers ----

// LLDAP GraphQL auth
func lldapAuth() (string, error) {
	url := cfg.lldapURL + "/auth/simple/login"
	reqBody, _ := json.Marshal(map[string]string{
		"username": cfg.lldapAdminUser,
		"password": cfg.lldapAdminPass,
	})
	req, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 403 {
		return "", fmt.Errorf("lldap auth failed: invalid credentials")
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("lldap auth %d: %s", resp.StatusCode, string(body))
	}

	var authResp map[string]interface{}
	if err := json.Unmarshal(body, &authResp); err != nil {
		return "", fmt.Errorf("lldap auth parse: %v", err)
	}
	token, ok := authResp["token"].(string)
	if !ok || token == "" {
		return "", fmt.Errorf("lldap auth: no token in response")
	}
	log.Printf("LLDAP auth succeeded (token len=%d)", len(token))
	return token, nil
}

// GraphQL query helper with auth header
func lldapGraphQL(query string, variables map[string]interface{}) ([]byte, error) {
	url := cfg.lldapURL + "/api/graphql"
	reqBody, err := json.Marshal(map[string]interface{}{
		"query":     query,
		"variables": variables,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if cfg.lldapToken != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.lldapToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Refresh token on 401
	if resp.StatusCode == 401 && cfg.lldapToken != "" {
		newToken, err := lldapAuth()
		if err != nil {
			return nil, fmt.Errorf("lldap token refresh failed: %v", err)
		}
		cfg.lldapToken = newToken
		req.Header.Set("Authorization", "Bearer "+cfg.lldapToken)
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("lldap graphql %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GraphQL mutation helper returning true/false + errors
func lldapMutate(query string, variables map[string]interface{}) (bool, error) {
	body, err := lldapGraphQL(query, variables)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, fmt.Errorf("lldap parse: %v", err)
	}
	if errs, ok := result["errors"].([]interface{}); ok && len(errs) > 0 {
		return false, fmt.Errorf("lldap graphql error: %v", errs[0])
	}
	return true, nil
}

// ---- LLDAP Handlers ----

func handleLLDAPUsersList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	query := `query { users { id email displayName firstName lastName groups { id displayName } } }`
	data, err := lldapGraphQL(query, nil)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPUsersCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	_, body := readBody(w, r)
	if body == nil {
		return
	}

	query := `mutation CreateUser($user: CreateUserInput!) { createUser(user: $user) { id email displayName } }`

	// Filter request body to only CreateUserInput fields
	// (groups/password must be managed via separate mutations)
	userInput := map[string]interface{}{}
	if upd, ok := body.(map[string]interface{}); ok {
		allowed := map[string]bool{"id": true, "email": true, "displayName": true,
			"firstName": true, "lastName": true, "avatar": true, "attributes": true}
		for k, v := range upd {
			if allowed[k] {
				userInput[k] = v
			}
		}
	}
	// LLDAP CreateUserInput requires id to be non-null
	if _, ok := userInput["id"]; !ok || userInput["id"] == nil || userInput["id"] == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "id is required for user creation"})
		return
	}
	vars := map[string]interface{}{"user": userInput}

	data, err := lldapGraphQL(query, vars)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-user", "created", body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	w.Write(data)
}

func handleLLDAPUserUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PATCH" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	userID := pathParts[len(pathParts)-1]

	_, body := readBody(w, r)
	if body == nil {
		return
	}

	query := `mutation UpdateUser($user: UpdateUserInput!) { updateUser(user: $user) { ok } }`
	// Filter request body to only UpdateUserInput fields
	// (groups must be managed via addUserToGroup/removeUserFromGroup mutations)
	userInput := map[string]interface{}{"id": userID}
	allowed := map[string]bool{"email": true, "displayName": true, "firstName": true,
		"lastName": true, "avatar": true, "removeAttributes": true, "insertAttributes": true}
	if upd, ok := body.(map[string]interface{}); ok {
		for k, v := range upd {
			if allowed[k] {
				userInput[k] = v
			}
		}
	}
	vars := map[string]interface{}{"user": userInput}

	data, err := lldapGraphQL(query, vars)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-user", "updated", userID)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPUserDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	userID := pathParts[len(pathParts)-1]

	query := `mutation DeleteUser($userId: String!) { deleteUser(userId: $userId) { ok } }`
	data, err := lldapGraphQL(query, map[string]interface{}{"userId": userID})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-user", "deleted", userID)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPGroupsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		w.WriteHeader(405)
		return
	}

	query := `query { groups { id displayName users { id email displayName } } }`
	data, err := lldapGraphQL(query, nil)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPGroupsCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	_, body := readBody(w, r)
	if body == nil {
		return
	}

	query := `mutation CreateGroup($name: String!) { createGroup(name: $name) { id displayName } }`
	name := ""
	if grp, ok := body.(map[string]interface{}); ok {
		if n, ok := grp["name"].(string); ok {
			name = n
		}
		if n, ok := grp["displayName"].(string); ok && name == "" {
			name = n
		}
	}
	if name == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "name or displayName required"})
		return
	}

	data, err := lldapGraphQL(query, map[string]interface{}{"name": name})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-group", "created", body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	w.Write(data)
}

func handleLLDAPGroupUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PATCH" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	groupID := pathParts[len(pathParts)-1]

	_, body := readBody(w, r)
	if body == nil {
		return
	}

	query := `mutation UpdateGroup($group: UpdateGroupInput!) { updateGroup(group: $group) { ok } }`
	gid := 0
	if f, ok := parseFloat(groupID); ok {
		gid = int(f)
	}

	vars := map[string]interface{}{
		"group": map[string]interface{}{"id": gid},
	}
	if upd, ok := body.(map[string]interface{}); ok {
		for k, v := range upd {
			vars["group"].(map[string]interface{})[k] = v
		}
	}

	data, err := lldapGraphQL(query, vars)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-group", "updated", groupID)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPGroupDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	groupID := pathParts[len(pathParts)-1]

	query := `mutation DeleteGroup($groupId: Int!) { deleteGroup(groupId: $groupId) { ok } }`
	gid := 0
	if f, ok := parseFloat(groupID); ok {
		gid = int(f)
	}
	data, err := lldapGraphQL(query, map[string]interface{}{"groupId": gid})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-group", "deleted", groupID)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPAddUserToGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// /api/groups/lldap/<groupId>/users/<userId> => last=userId, second-last=users, third-last=groupId
	if len(pathParts) < 5 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid path"})
		return
	}
	userId := pathParts[len(pathParts)-1]
	groupID := pathParts[len(pathParts)-3]

	query := `mutation AddUserToGroup($userId: String!, $groupId: Int!) { addUserToGroup(userId: $userId, groupId: $groupId) { ok } }`
	gid := 0
	if f, ok := parseFloat(groupID); ok {
		gid = int(f)
	}
	data, err := lldapGraphQL(query, map[string]interface{}{"userId": userId, "groupId": gid})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-group", "user_added", groupID+"/"+userId)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func handleLLDAPRemoveUserFromGroup(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		w.WriteHeader(405)
		return
	}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 5 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid path"})
		return
	}
	userId := pathParts[len(pathParts)-1]
	groupID := pathParts[len(pathParts)-3]

	query := `mutation RemoveUserFromGroup($userId: String!, $groupId: Int!) { removeUserFromGroup(userId: $userId, groupId: $groupId) { ok } }`
	gid := 0
	if f, ok := parseFloat(groupID); ok {
		gid = int(f)
	}
	data, err := lldapGraphQL(query, map[string]interface{}{"userId": userId, "groupId": gid})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	logAudit(w, "lldap-group", "user_removed", groupID+"/"+userId)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func parseFloat(s string) (float64, bool) {
	var f float64
	_, err := fmt.Sscanf(s, "%f", &f)
	return f, err == nil
}

// ---- CORS Middleware ----

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

// ---- Main ----

func main() {
	cfg = config{
		directusURL:   getEnv("DIRECTUS_URL", "http://directus.webapps:8055"),
		directusEmail: getEnv("DIRECTUS_EMAIL", "admin@becklab.cloud"),
		directusPass:  getEnv("DIRECTUS_PASSWORD", "suCNJ5CtDdHEdy3Zhy6azwgG"),
		keycloakURL:   getEnv("KEYCLOAK_URL", "http://keycloak.identity:8080"),
		k8sAPI:        getEnv("K8S_API", "https://172.16.0.20:6443"),
		redisHost:     getEnv("REDIS_HOST", "10.43.139.161"),
		redisPort:     6379,
		redisPass:     getEnv("REDIS_PASSWORD", ""),
		port:          getEnv("PORT", "8080"),
		lldapURL:       getEnv("LLDAP_URL", "http://lldap.identity:17170"),
		lldapAdminUser: getEnv("LLDAP_ADMIN_USER", "admin"),
		lldapAdminPass: getEnv("LLDAP_ADMIN_PASSWORD", ""),
		lldapTokenTTL:  getIntEnv("LLDAP_TOKEN_TTL", 3600),
	}

	log.Printf("Admin Panel API starting on port %s", cfg.port)
	log.Printf("Directus: %s", cfg.directusURL)
	log.Printf("Keycloak: %s", cfg.keycloakURL)
	log.Printf("LLDAP: %s", cfg.lldapURL)

	// Pre-auth with LLDAP
	if cfg.lldapAdminUser != "" && cfg.lldapAdminPass != "" {
		if token, err := lldapAuth(); err != nil {
			log.Printf("LLDAP auth failed on startup: %v", err)
		} else {
			cfg.lldapToken = token
			log.Printf("LLDAP token cached (TTL=%ds)", cfg.lldapTokenTTL)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", corsMiddleware(router))

	srv := &http.Server{
		Addr:         ":" + cfg.port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getIntEnv(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}
