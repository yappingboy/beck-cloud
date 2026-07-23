package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type request struct {
	Operation string          `json:"operation"`
	Input     string          `json:"input"`
	Schema    json.RawMessage `json:"schema,omitempty"`
	Path      string          `json:"path,omitempty"`
	Second    string          `json:"second,omitempty"`
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

func formatHandler(w http.ResponseWriter, r *http.Request) {
	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON"}, Meta: meta{RequestID: genID()}})
		return
	}
	if req.Input == "" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "input required"}, Meta: meta{RequestID: genID()}})
		return
	}

	var result interface{}
	var err error

	switch strings.ToLower(req.Operation) {
	case "format_json":
		if err = json.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON: " + err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		out, _ := json.MarshalIndent(result, "", "  ")
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": string(out)}, Meta: meta{RequestID: genID()}})

	case "format_yaml":
		if err = yaml.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid YAML: " + err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		out, _ := yaml.Marshal(result)
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": string(out)}, Meta: meta{RequestID: genID()}})

	case "yaml_to_json":
		if err = yaml.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid YAML: " + err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		out, _ := json.MarshalIndent(result, "", "  ")
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": string(out)}, Meta: meta{RequestID: genID()}})

	case "json_to_yaml":
		if err = json.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid JSON: " + err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		out, _ := yaml.Marshal(result)
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": string(out)}, Meta: meta{RequestID: genID()}})

	case "validate_json":
		if err = json.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"valid": "false", "error": err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"valid": "true"}, Meta: meta{RequestID: genID()}})

	case "validate_yaml":
		if err = yaml.Unmarshal([]byte(req.Input), &result); err != nil {
			writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"valid": "false", "error": err.Error()}, Meta: meta{RequestID: genID()}})
			return
		}
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"valid": "true"}, Meta: meta{RequestID: genID()}})

	case "extract":
		if err = yaml.Unmarshal([]byte(req.Input), &result); err != nil {
			if err = json.Unmarshal([]byte(req.Input), &result); err != nil {
				writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid input"}, Meta: meta{RequestID: genID()}})
				return
			}
		}
		val := extractValue(result, req.Path)
		if val == nil {
			writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": "null"}, Meta: meta{RequestID: genID()}})
			return
		}
		out, _ := json.MarshalIndent(val, "", "  ")
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": string(out)}, Meta: meta{RequestID: genID()}})

	case "diff":
		var a, b interface{}
		if err = yaml.Unmarshal([]byte(req.Input), &a); err != nil {
			if err = json.Unmarshal([]byte(req.Input), &a); err != nil {
				writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid first input"}, Meta: meta{RequestID: genID()}})
				return
			}
		}
		if err = yaml.Unmarshal([]byte(req.Second), &b); err != nil {
			if err = json.Unmarshal([]byte(req.Second), &b); err != nil {
				writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": "invalid second input"}, Meta: meta{RequestID: genID()}})
				return
			}
		}
		diff := deepEqual(a, b)
		writeJSON(w, http.StatusOK, response{Status: "success", Result: map[string]string{"result": diff}, Meta: meta{RequestID: genID()}})

	default:
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Result: map[string]string{"error": fmt.Sprintf("unknown operation: %s", req.Operation)}, Meta: meta{RequestID: genID()}})
		return
	}
}

func extractValue(v interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	current := v
	for _, p := range parts {
		switch m := current.(type) {
		case map[string]interface{}:
			current = m[p]
		default:
			return nil
		}
	}
	return current
}

func deepEqual(a, b interface{}) string {
	if fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b) {
		return "identical"
	}
	var buf bytes.Buffer
	printDiff(&buf, "", a, b, 0)
	return buf.String()
}

func printDiff(w *bytes.Buffer, prefix string, a, b interface{}, depth int) {
	indent := strings.Repeat("  ", depth)
	switch ma := a.(type) {
	case map[string]interface{}:
		if mb, ok := b.(map[string]interface{}); ok {
			for k := range ma {
				if valB, ok2 := mb[k]; ok2 {
					printDiff(w, fmt.Sprintf("%s.%s", prefix, k), ma[k], valB, depth+1)
				} else {
					w.WriteString(fmt.Sprintf("%s%s: only in first (key: %s)\n", indent, prefix, k))
				}
			}
			for k := range mb {
				if _, ok := ma[k]; !ok {
					w.WriteString(fmt.Sprintf("%s%s: only in second (key: %s)\n", indent, prefix, k))
				}
			}
		}
	default:
		if a != b {
			w.WriteString(fmt.Sprintf("%s%s: different values: %v != %v\n", indent, prefix, a, b))
		}
	}
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

	http.HandleFunc("/api/v1/fmt", formatHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })

	log.Printf("yaml-json-tool listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
