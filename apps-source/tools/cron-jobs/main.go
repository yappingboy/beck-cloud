package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type cronJob struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	CronExpr    string    `json:"cronExpr"`
	URL         string    `json:"url"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	LastRun     *time.Time `json:"lastRun,omitempty"`
	NextRun     *time.Time `json:"nextRun,omitempty"`
}

type request struct {
	Name     string `json:"name"`
	CronExpr string `json:"cronExpr"`
	URL      string `json:"url"`
	Enabled  bool   `json:"enabled"`
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
var mu sync.Mutex
var scheduler *Scheduler

func initDB() error {
	var err error
	db, err = sql.Open("sqlite", "/data/cron-jobs.db")
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			cron_expr TEXT NOT NULL,
			url TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			last_run TEXT,
			next_run TEXT
		);
	`)
	return err
}

type Scheduler struct {
	jobs map[string]*scheduledJob
}

type scheduledJob struct {
	job    *cronJob
	ticker *time.Ticker
	cancel func()
}

func (s *Scheduler) Add(j *cronJob) error {
	mu.Lock()
	defer mu.Unlock()

	if s.jobs == nil {
		s.jobs = make(map[string]*scheduledJob)
	}

	s.jobs[j.ID] = &scheduledJob{job: j}
	return nil
}

func (s *Scheduler) StartAll() {
	mu.Lock()
	defer mu.Unlock()

	for _, sj := range s.jobs {
		go sj.loop()
	}
}

func (sj *scheduledJob) loop() {
	interval := parseCronInterval(sj.job.CronExpr)
	if interval == 0 {
		interval = time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sj.trigger()
		}
	}
}

func (sj *scheduledJob) trigger() {
	resp, err := http.Get(sj.job.URL)
	if err != nil {
		log.Printf("cron job %s: %v", sj.job.ID, err)
		return
	}
	resp.Body.Close()

	now := time.Now().UTC()
	_, err = db.Exec("UPDATE jobs SET last_run = ?, next_run = ? WHERE id = ?",
		now.Format(time.RFC3339), now.Add(1*time.Hour).Format(time.RFC3339), sj.job.ID)
	if err != nil {
		log.Printf("cron job %s: update error: %v", sj.job.ID, err)
	}
}

func parseCronInterval(expr string) time.Duration {
	if strings.Contains(expr, "*/") {
		return time.Hour
	}
	if strings.Contains(expr, "*") {
		return time.Minute
	}
	return time.Hour
}

func genID() string {
	b := make([]byte, 16)
	// simple ID generation
	for i := range b {
		b[i] = byte(os.Getpid()%256 + i)
	}
	return fmt.Sprintf("%x", b)
}

func jobsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listJobs(w, r)
	case http.MethodPost:
		createJob(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
	}
}

func listJobs(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, cron_expr, url, enabled, created_at, last_run, next_run FROM jobs")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}
	defer rows.Close()

	var jobs []cronJob
	for rows.Next() {
		var j cronJob
		var lastRun, nextRun sql.NullString
		rows.Scan(&j.ID, &j.Name, &j.CronExpr, &j.URL, &j.Enabled, &j.CreatedAt, &lastRun, &nextRun)
		if lastRun.Valid {
			t, _ := time.Parse(time.RFC3339, lastRun.String)
			j.LastRun = &t
		}
		if nextRun.Valid {
			t, _ := time.Parse(time.RFC3339, nextRun.String)
			j.NextRun = &t
		}
		j.Enabled = j.Enabled == true
		jobs = append(jobs, j)
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: jobs, Meta: meta{RequestID: genID()}})
}

func createJob(w http.ResponseWriter, r *http.Request) {
	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.Name == "" || req.CronExpr == "" || req.URL == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "name, cronExpr, url required"}, Meta: meta{RequestID: genID()}})
		return
	}

	id := genID()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec("INSERT INTO jobs (id, name, cron_expr, url, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, req.Name, req.CronExpr, req.URL, 1, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}

	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"id": id}, Meta: meta{RequestID: genID()}})
}

func jobHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/jobs/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		getJob(w, r, id)
	case http.MethodPost:
		triggerJob(w, r, id)
	case http.MethodPatch:
		patchJob(w, r, id)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, response{Status: "error", Result: map[string]string{"error": "method not allowed"}, Meta: meta{RequestID: genID()}})
	}
}

func getJob(w http.ResponseWriter, r *http.Request, id string) {
	var j cronJob
	var lastRun, nextRun sql.NullString
	err := db.QueryRow("SELECT id, name, cron_expr, url, enabled, created_at, last_run, next_run FROM jobs WHERE id = ?", id).Scan(
		&j.ID, &j.Name, &j.CronExpr, &j.URL, &j.Enabled, &j.CreatedAt, &lastRun, &nextRun)
	if err != nil {
		writeJSON(w, http.StatusNotFound, response{Status: "error", Result: map[string]string{"error": "not found"}, Meta: meta{RequestID: genID()}})
		return
	}
	if lastRun.Valid {
		t, _ := time.Parse(time.RFC3339, lastRun.String)
		j.LastRun = &t
	}
	if nextRun.Valid {
		t, _ := time.Parse(time.RFC3339, nextRun.String)
		j.NextRun = &t
	}
	writeJSON(w, http.StatusOK, response{Status: "success", Result: j, Meta: meta{RequestID: genID()}})
}

func triggerJob(w http.ResponseWriter, r *http.Request, id string) {
	_, err := db.Exec("UPDATE jobs SET last_run = ? WHERE id = ?", time.Now().UTC().Format(time.RFC3339), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}
	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"message": "triggered"}, Meta: meta{RequestID: genID()}})
}

func patchJob(w http.ResponseWriter, r *http.Request, id string) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	set := []string{}
	args := []interface{}{}
	if v, ok := body["enabled"].(bool); ok {
		set = append(set, "enabled = ?")
		args = append(args, v)
	}
	if len(set) == 0 {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "no fields to update"}, Meta: meta{RequestID: genID()}})
		return
	}
	args = append(args, id)
	_, err := db.Exec(fmt.Sprintf("UPDATE jobs SET %s WHERE id = ?", strings.Join(set, ", ")), args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, response{Status: "error", Result: map[string]string{"error": "db error"}, Meta: meta{RequestID: genID()}})
		return
	}
	writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"message": "updated"}, Meta: meta{RequestID: genID()}})
}

func writeJSON(w http.ResponseWriter, code int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(body)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	rows, _ := db.Query("SELECT COUNT(*), SUM(enabled) FROM jobs")
	var total, enabled int
	if rows.Next() {
		rows.Scan(&total, &enabled)
	}
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# HELP cron_jobs_total Total cron jobs\n# TYPE cron_jobs_total gauge\ncron_jobs_total %d\n# HELP cron_jobs_enabled Enabled cron jobs\n# TYPE cron_jobs_enabled gauge\ncron_jobs_enabled %d\n", total, enabled)
}

func main() {
	if err := initDB(); err != nil {
		log.Fatalf("init db: %v", err)
	}
	scheduler = &Scheduler{}
	scheduler.StartAll()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/jobs", jobsHandler)
	mux.HandleFunc("/api/v1/jobs/", jobHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	log.Printf("cron-jobs listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
