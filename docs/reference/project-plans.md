# BeckCloud Micro — Project Plans

> "10 micro-services, one server, zero new hardware."

**Created:** 2026-07-23  
**Owner:** Stephen  
**Status:** Planning

---

## Overview

BeckCloud Micro is a suite of lightweight, stateless micro-services hosted on the existing K3s cluster. Each service is a single binary or container, uses <10MB RAM, and responds in <100ms. Services are individually useful and collectively chained through the **BeckFlow** workflow dashboard.

**Repository structure:**
```
beck-cloud/
├── flux/infrastructure/micro/          # Kubernetes manifests (new namespace)
│   ├── namespace.yaml
│   ├── pvcs.yaml                        # Shared PVCs
│   ├── services/                        # Per-service deployments
│   │   ├── hash/
│   │   ├── url-shortener/
│   │   ├── base64/
│   │   ├── markdown-renderer/
│   │   ├── image-resize/
│   │   ├── cron-jobs/
│   │   ├── dns-monitor/
│   │   ├── webhook-relay/
│   │   ├── yaml-json-tool/
│   │   ├── qr-generator/
│   │   └── image-editor/
│   ├── middlewares.yaml                 # Service-specific Traefik middlewares
│   └── certificates.yaml                # TLS certs for tools.becklab.cloud
├── flux/infrastructure/tools-kustomization.yaml  # Kustomization entry
├── tools/                               # Source code for all services
│   ├── hash/
│   ├── url-shortener/
│   ├── base64/
│   ├── markdown-renderer/
│   ├── image-resize/
│   ├── cron-jobs/
│   ├── dns-monitor/
│   ├── webhook-relay/
│   ├── yaml-json-tool/
│   ├── qr-generator/
│   ├── image-editor/                    # Browser-based (frontend + API)
│   └── beckflow/                        # Workflow dashboard (React)
├── docs/reference/business-plan.md
└── docs/reference/project-plans.md
```

---

## Shared Architecture

### Namespace: `micro`

All micro-services live in a dedicated `micro` namespace. Resource quotas cap total usage:
- **CPU:** 4 cores total
- **Memory:** 2 GiB total
- **PVCs:** 10 GiB shared storage

This is a hard budget. No service can exceed its allocation.

### Service Contract

Every service follows the same API contract:

```yaml
# Request
POST /api/v1/<service>/process
{
  "input": "<data>",
  "options": {}
}

# Response (all services)
{
  "status": "success" | "queued" | "error",
  "result": { "data": "...", "url": "https://tools.becklab.cloud/storage/<id>" },
  "meta": {
    "requestId": "uuid",
    "processedAt": "2026-07-23T01:00:00Z",
    "freeTier": true,
    "freeTierRemaining": 99
  }
}
```

### Storage

- **Ephemeral storage:** In-memory or local temp dir (free tier results expire in 24h)
- **Persistent storage:** Shared PVC `micro-storage` (10 GiB, for paid tier data)
- **Queue:** Redis from identity namespace (shared, read-only connection)

### Rate Limits (per IP, free tier)

| Service | Limit | Burst |
|---------|-------|-------|
| Hash | 100 req/day | 10/min |
| URL Shortener | 100 links/day | 5/min |
| Base64 | 100 req/day | 20/min |
| Markdown | 50 req/day | 5/min |
| Image Resize | 100 req/day | 5/min |
| Cron Jobs | 10 jobs | — |
| DNS Monitor | 50 checks/day | 10/min |
| Webhook Relay | 100 webhooks/day | — |
| YAML/JSON | 200 req/day | 20/min |
| QR Code | 50 QR/month | 10/min |
| Image Editor | 10 saves/day | — |
| BeckFlow | 50 runs/month | — |

### Authentication

- **Free tier:** IP-based (no login required)
- **Paid tier:** API key in `Authorization: Bearer <key>` header
- Key management: simple JWT stored in Redis (no new DB needed)
- API key rotation: each key has TTL, auto-expire after 90 days

### Monitoring

- Each service exposes `/metrics` (Prometheus format)
- Grafana dashboard in monitoring namespace (created once, add services incrementally)
- Alerts: container restarts, response time >5s, Redis connection failures

---

## Phase 1: Core Services (Week 1-2)

These 5 services form the foundation. Each is deployable independently.

### Service 1: Hash Function Service

**Endpoint:** `hash.becklab.cloud`

**Capabilities:**
- SHA-256, SHA-512, SHA-256-HMAC (with key)
- MD5 (legacy)
- Base64 encode/decode
- Hex encode/decode
- ASCII ↔ Hex conversion

**Tech:** Go binary (`hasher`), single file, no dependencies
- Binary size: <5MB
- RAM: <2MB
- Response time: <1ms

**Free tier:** 100 requests/day per IP
**Paid tier ($1/mo):** Unlimited + API key + HMAC with stored keys + webhook on collision detection

**Implementation:**
```go
// hasher/main.go — single file
package main

// - SHA-256, SHA-512
// - SHA-256-HMAC with key parameter
// - MD5 (legacy)
// - Base64 encode/decode
// - Hex encode/decode
// - ASCII ↔ Hex
// - POST /api/v1/hash with {"algo":"sha256","input":"hello"}
// - Returns {"status":"success","result":{"hash":"..."},"meta":{"requestId":"..."}}
```

**Files:**
- `tools/hash/main.go` — Server code
- `tools/hash/Dockerfile` — Alpine-based, single binary
- `flux/infrastructure/micro/services/hash/deployment.yaml` — K8s deployment
- `flux/infrastructure/micro/services/hash/service.yaml` — ClusterIP service
- `flux/infrastructure/micro/services/hash/ingress.yaml` — IngressRoute

**Deploy time:** ~30 minutes

---

### Service 2: URL Shortener

**Endpoint:** `short.becklab.cloud`

**Capabilities:**
- Create short link: `POST /api/v1/links` → `{shortCode}`
- Redirect: `GET /<shortCode>` → 302 to original
- Click tracking: logs IP, user-agent, timestamp, referrer
- Link stats: `GET /api/v1/links/<code>/stats` → clicks, locations, devices
- Bulk create: `POST /api/v1/links/bulk` → array of short codes
- Link expiration: optional TTL parameter
- Custom alias: optional custom short code

**Tech:** Go binary (`shortener`), SQLite for storage (embedded, no separate DB)
- Binary size: <10MB
- RAM: <5MB
- Response time: <5ms

**Free tier:** 100 links/day, 7-day click history, basic stats
**Paid tier ($1/mo):** Unlimited links, unlimited history, geographic stats, UTM parameter tracking, custom alias

**Implementation:**
```go
// shortener/main.go
// - SQLite embedded database (modernc.org/sqlite — pure Go, no CGO)
// - REST API for link CRUD
// - 302 redirect handler
// - Click tracking middleware
// - Stats endpoint with aggregate queries
// - Bulk create support
```

**Files:**
- `tools/url-shortener/main.go` — Server code
- `tools/url-shortener/go.mod` — Dependencies
- `tools/url-shortener/Dockerfile`
- `flux/infrastructure/micro/services/url-shortener/deployment.yaml`
- `flux/infrastructure/micro/services/url-shortener/pvc.yaml` — SQLite data volume (1 GiB)

**Deploy time:** ~1 hour

---

### Service 3: Base64 / Converter

**Endpoint:** `convert.becklab.cloud`

**Capabilities:**
- Base64 encode/decode
- URL encode/decode
- HTML entity encode/decode
- Hex ↔ ASCII
- ROT13
- UUID v4 generation
- Random string generation (configurable length/charset)

**Tech:** Go binary (`converter`), single file, no dependencies
- Binary size: <5MB
- RAM: <2MB
- Response time: <1ms

**Free tier:** 100 requests/day per IP
**Paid tier ($1/mo):** Unlimited + batch processing (process multiple inputs in one request)

**Implementation:**
```go
// converter/main.go — single file
// - Base64, URL, HTML entity encode/decode
// - Hex/ASCII, ROT13
// - UUID v4 generation
// - Random string generation
// - POST /api/v1/convert with {"operation":"base64_encode","input":"hello"}
```

**Files:**
- `tools/base64/main.go`
- `tools/base64/Dockerfile`
- `flux/infrastructure/micro/services/base64/deployment.yaml`

**Deploy time:** ~30 minutes

---

### Service 4: Markdown Renderer

**Endpoint:** `render.becklab.cloud`

**Capabilities:**
- Markdown → HTML
- Markdown → PDF
- Markdown → PNG (via html-to-image)
- Syntax highlighting (Prism.js embedded)
- Math rendering (KaTeX)
- Mermaid diagrams
- Custom CSS injection (paid)

**Tech:** Python (`markdown` + `weasyprint` for PDF + `pypng`) or Go (`goldmark` + `chroma`)
- Binary size: ~50MB (Python) or ~15MB (Go)
- RAM: ~30MB
- Response time: 50-200ms

**Free tier:** 50 renders/day, HTML only, no custom CSS
**Paid tier ($2/mo):** Unlimited + PDF + PNG + KaTeX + Mermaid + custom CSS

**Implementation:**
```go
// markdown-renderer/main.go — Go implementation
// - goldmark parser (Markdown → AST)
// - chroma syntax highlighting
// - KaTeX for math (static binary)
// - WeasyPrint/Pango for PDF
// - html-to-image for PNG
// - POST /api/v1/render with {"format":"html","markdown":"# Hello"}
```

**Files:**
- `tools/markdown-renderer/main.go`
- `tools/markdown-renderer/Dockerfile` — Alpine with pango/katex
- `flux/infrastructure/micro/services/markdown-renderer/deployment.yaml`

**Deploy time:** ~1 hour

---

### Service 5: Image Resize

**Endpoint:** `img.becklab.cloud`

**Capabilities:**
- Resize by dimensions (exact, fit, fill, crop)
- Format conversion (PNG → WebP, JPEG → WebP, etc.)
- Quality control (1-100)
- Auto-format detection (accept image/*, returns optimal format)
- URL input (fetch from URL, resize, cache)
- Batch resize (multiple images, one request)

**Tech:** Go with `libvips` (via CGO) or Python with `Pillow`
- Binary size: ~30MB (Go/libvips) or ~80MB (Python/Pillow)
- RAM: ~50MB
- Response time: 100-500ms (depends on image size)

**Free tier:** 100 images/day, max 5MB input, standard resize
**Paid tier ($2/mo):** Unlimited + batch resize + quality optimization + URL input caching

**Implementation:**
```go
// image-resize/main.go
// - libvips via CGO for high-performance resize
// - WebP encoding (libwebp)
// - EXIF preservation (paid)
// - POST /api/v1/resize with {"url":"...","width":800,"height":600,"format":"webp"}
// - Returns image data or download URL
```

**Files:**
- `tools/image-resize/main.go`
- `tools/image-resize/Dockerfile` — Alpine with libvips + libwebp
- `flux/infrastructure/micro/services/image-resize/deployment.yaml`

**Deploy time:** ~2 hours

---

## Phase 2: Monitoring & Utilities (Week 3-4)

### Service 6: Cron Job Service

**Endpoint:** `cron.becklab.cloud`

**Capabilities:**
- Schedule: `POST /api/v1/jobs` with cron expression
- Manual trigger: `POST /api/v1/jobs/<id>/trigger`
- Job logs: `GET /api/v1/jobs/<id>/logs`
- Status: `GET /api/v1/jobs/<id>/status`
- Pause/resume: `PATCH /api/v1/jobs/<id>`

**Tech:** Go binary, Linux `cron` for execution, SQLite for scheduling
- Binary size: <10MB
- RAM: <5MB
- Response time: <10ms

**Free tier:** 10 jobs, daily logs retained 7 days
**Paid tier ($3/mo):** 50 jobs, logs retained 30 days, email notifications on failure

**Files:**
- `tools/cron-jobs/main.go`
- `tools/cron-jobs/Dockerfile`
- `flux/infrastructure/micro/services/cron-jobs/deployment.yaml`
- `flux/infrastructure/micro/services/cron-jobs/pvc.yaml` — SQLite + logs (2 GiB)

**Deploy time:** ~2 hours

---

### Service 7: DNS Monitor

**Endpoint:** `dns.becklab.cloud`

**Capabilities:**
- DNS lookups: A, AAAA, MX, TXT, CNAME, NS, SOA
- HTTP health checks: configurable intervals, timeout, expected status code
- TLS certificate inspection: expiry date, issuer, SANs
- Historical tracking with timestamps
- Alert on change: webhook notification when DNS record changes
- Historical trend charts (paid)

**Tech:** Go binary using `miekg/dns` library
- Binary size: <10MB
- RAM: <5MB
- Response time: <50ms (DNS query latency)

**Free tier:** 50 checks/day, 24h history
**Paid tier ($2/mo):** Unlimited checks, 30-day history, webhook alerts on change

**Files:**
- `tools/dns-monitor/main.go`
- `tools/dns-monitor/Dockerfile`
- `flux/infrastructure/micro/services/dns-monitor/deployment.yaml`
- `flux/infrastructure/micro/services/dns-monitor/pvc.yaml` — History (1 GiB)

**Deploy time:** ~2 hours

---

### Service 8: Webhook Relay

**Endpoint:** `webhook.becklab.cloud`

**Capabilities:**
- Create endpoint: `POST /api/v1/endpoints` → URL
- Deliver webhooks with retry (exponential backoff)
- Payload transformation (JSON → form, add headers, filter fields)
- Delivery logs with timestamps, status codes, response bodies
- Replay: resend failed deliveries
- Signature verification (HMAC-SHA256)

**Tech:** Go binary, Redis for queue, SQLite for logs
- Binary size: <10MB
- RAM: <5MB
- Response time: <10ms (relay), <5s (delivery)

**Free tier:** 100 deliveries/day, 24h log retention
**Paid tier ($3/mo):** Unlimited, 30-day logs, payload transformation, signature verification

**Files:**
- `tools/webhook-relay/main.go`
- `tools/webhook-relay/Dockerfile`
- `flux/infrastructure/micro/services/webhook-relay/deployment.yaml`
- `flux/infrastructure/micro/services/webhook-relay/pvc.yaml` — Logs (2 GiB)

**Deploy time:** ~3 hours

---

### Service 9: YAML/JSON Tool

**Endpoint:** `fmt.becklab.cloud`

**Capabilities:**
- Format/indent YAML or JSON
- Convert YAML ↔ JSON
- Diff two YAML/JSON files
- Validate YAML/JSON against schema
- Extract values: `$.path.to.value` (JMESPath-style)
- Merge multiple files

**Tech:** Go binary using `santhosh-tekuri/jsonschema` and `gopkg.in/yaml.v3`
- Binary size: <10MB
- RAM: <5MB
- Response time: <10ms

**Free tier:** 200 requests/day, basic format/convert/extract
**Paid tier ($1/mo):** Schema validation, diff with color output, merge, JMESPath queries

**Files:**
- `tools/yaml-json-tool/main.go`
- `tools/yaml-json-tool/Dockerfile`
- `flux/infrastructure/micro/services/yaml-json-tool/deployment.yaml`

**Deploy time:** ~1 hour

---

## Phase 3: Visual Services (Week 5-6)

### Service 10: QR Code Generator

**Endpoint:** `qr.becklab.cloud`

**Capabilities:**
- Text → QR code
- URL → QR code
- WiFi config → QR code (WPA/WPA2, hidden SSID support)
- vCard → QR code (contact info)
- Email → QR code
- SMS → QR code
- Geo location → QR code
- Output formats: PNG, SVG
- Error correction levels: L, M, Q, H
- Size control: 100px to 4000px

**Tech:** Go binary using `github.com/skip2/go-qrcode`
- Binary size: <5MB
- RAM: <2MB
- Response time: <5ms

**Free tier:** 50 QR/month, PNG, standard size (max 500px), standard error correction
**Paid tier ($1/mo):** Unlimited, SVG output, high-res (up to 4000px), WiFi config template, vCard template, batch generate

**Files:**
- `tools/qr-generator/main.go`
- `tools/qr-generator/Dockerfile`
- `flux/infrastructure/micro/services/qr-generator/deployment.yaml`

**Deploy time:** ~1 hour

---

### Service 11: Image Editor

**Endpoint:** `editor.becklab.cloud`

**Capabilities:**
- Crop (rectangle, freeform)
- Resize (width/height, fit, fill, crop)
- Rotate (90°, 180°, 270°, custom angle)
- Filters: grayscale, sepia, blur, sharpen, brightness, contrast, saturation
- Text overlay (font, size, color, position)
- Basic compositing (layer overlay, blend modes)
- Undo/redo (history stack)
- Layer support (paid)
- Export: PNG, JPEG, WebP

**Tech:** Browser-based (`canvas` API) + Go API for save/load/complex operations
- Frontend: React + Fabric.js (canvas manipulation library)
- Backend: Go binary (`image-editor`) — handles save/load, complex filters
- RAM: ~20MB server-side, browser handles rendering
- Response time: <100ms for save/load, client-side for edits

**Free tier:** Basic tools (crop, resize, rotate, filters), 24h ephemeral saves
**Paid tier ($3/mo):** Layers, unlimited history, persistent storage, batch processing, custom fonts

**Files:**
- `tools/image-editor/frontend/src/` — React app
- `tools/image-editor/frontend/public/` — Static assets
- `tools/image-editor/main.go` — Save/load API
- `tools/image-editor/Dockerfile` — Nginx (frontend) + Go (API)
- `flux/infrastructure/micro/services/image-editor/deployment.yaml`
- `flux/infrastructure/micro/services/image-editor/pvc.yaml` — Saved images (2 GiB)

**Deploy time:** ~3 hours

---

## Phase 4: BeckFlow Dashboard (Week 7-8)

### BeckFlow — Workflow Dashboard

**Endpoint:** `tools.becklab.cloud`

**Concept:** Single-page app where services chain together via visual workflow builder.

**Tech:** React SPA + Go API gateway
- Frontend: React + TypeScript, hosted via Nginx in-cluster
- Backend: Go API gateway that routes to individual services
- State: Redis (workflow execution state between steps)
- Storage: PVC for uploaded files during workflow execution

**Dashboard features:**
1. **Workflow Builder** — Drag-and-drop service nodes, connect with arrows, configure parameters
2. **Workflow Library** — Save/load pre-built workflows, share with team
3. **Execution History** — Run history, logs, results, re-run
4. **Usage Stats** — Per-service usage, total runs, time spent
5. **API Key Manager** — Generate/rotate API keys, view usage

**Pre-built workflows:**

| Name | Chain | Description |
|------|-------|-------------|
| Scan to Print-Ready | Image Upload → Resize → WebP Convert → Hash → QR Code | Archive a physical document, verify integrity with hash QR |
| QR Business Card | vCard Input → QR Code → Resize → WebP Convert → URL Shortener | Create a shareable QR business card with analytics |
| API Key Generator | Random String → Hash → QR Code → Base64 Encode → Cron (rotate monthly) | Generate and auto-rotate API keys |
| Deploy Check | YAML File → Validate → Hash Configs → Cron (daily) → Webhook on Change | Monitor config drift |
| Blog Post Pipeline | Markdown Input → Render HTML → Extract Images → Resize → OG Image Overlay | Generate social media cards from markdown |
| CI Artifact | Build Output → Hash → Upload → QR Code (link to artifact) | Create checksum + QR for build artifacts |

**API Gateway (Go):**
```go
// beckflow/gateway/main.go
// - Routes to individual service APIs
// - Manages workflow state in Redis
// - Provides unified response format
// - Rate limiting per API key
// - Authentication (API key validation)
```

**React Frontend:**
```tsx
// tools/beckflow/frontend/src/
// - Workflow builder canvas (react-flow or custom)
// - Service node library (draggable service cards)
// - Parameter configuration panels
// - Execution history panel
// - Usage dashboard
```

**Files:**
- `tools/beckflow/gateway/main.go` — API gateway
- `tools/beckflow/frontend/src/` — React app
- `tools/beckflow/frontend/package.json`
- `tools/beckflow/Dockerfile` — Nginx + Go
- `flux/infrastructure/micro/services/beckflow/deployment.yaml`
- `flux/infrastructure/micro/services/beckflow/pvc.yaml` — Uploaded files (2 GiB)
- `flux/infrastructure/micro/services/beckflow/ingress.yaml` — `tools.becklab.cloud`

**Deploy time:** ~4 hours

---

## Phase 5: Integration & Polish (Week 9-10)

### Infrastructure

1. **Namespace setup** — `micro` namespace with resource quotas
2. **Shared PVCs** — `micro-storage` (10 GiB shared)
3. **Redis connection** — Read-only to identity namespace Redis
4. **TLS** — Single cert for `*.tools.becklab.cloud` + `*.becklab.cloud` for individual service subdomains
5. **Middlewares** — Per-service rate limiting, auth headers, CORS (for browser-based services)
6. **Prometheus metrics** — Each service exports `/metrics`
7. **Grafana dashboard** — Add `micro` namespace dashboards

### Per-Service Kustomizations

Each service follows this pattern in `flux/infrastructure/micro/services/<name>/`:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <service-name>
  namespace: micro
spec:
  replicas: 1
  resources:
    requests:
      cpu: 50m
      memory: 10Mi
    limits:
      cpu: 200m
      memory: 50Mi
---
# service.yaml (ClusterIP)
# ingress.yaml (IngressRoute → tools.becklab.cloud/<name>)
```

### Rate Limiting Middleware

```yaml
# flux/infrastructure/micro/middlewares.yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit-hash
  namespace: micro
spec:
  rateLimit:
    average: 10
    burst: 5
    period: 60s
```

### TLS Certificates

```yaml
# flux/infrastructure/micro/certificates.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: tools-certificate
  namespace: micro
spec:
  secretName: tools-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: tools.becklab.cloud
  dnsNames:
    - tools.becklab.cloud
    - hash.tools.becklab.cloud
    - short.tools.becklab.cloud
    - convert.tools.becklab.cloud
    - render.tools.becklab.cloud
    - img.tools.becklab.cloud
    - cron.tools.becklab.cloud
    - dns.tools.becklab.cloud
    - webhook.tools.becklab.cloud
    - fmt.tools.becklab.cloud
    - qr.tools.becklab.cloud
    - editor.tools.becklab.cloud
```

---

## Build Pipeline

### Kaniko Builds

Each service builds via Kaniko in the `toolbox` namespace:

```yaml
# tools/<name>/kaniko-build.yaml
apiVersion: build.knative.dev/v1alpha1
kind: Build
metadata:
  name: <service-name>-build
  namespace: toolbox
spec:
  serviceAccount: ghcr-toolbox
  template:
    spec:
      stepOverrides:
        - name: kaniko
          image: gcr.io/kaniko-project/executor:latest
      steps:
        - name: build
          image: gcr.io/kaniko-project/executor:latest
          args:
            - --context=git://github.com/yappingboy/beck-cloud.git#main:tools/<name>/
            - --destination=ghcr.io/yappingboy/<service-name>:<tag>
            - --tarPath=/workspace/<name>-image.tar
      volumes:
        - name: workspace
          emptyDir: {}
      initContainers:
        - name: clone
          image: alpine/git
          command: ["/bin/sh", "-c", "git clone ..."]
          volumeMounts:
            - name: workspace
              mountPath: /workspace
```

### Build Trigger

Manual Kaniko build per service (not automated — we control releases). Flux syncs the final manifests from `flux/infrastructure/micro/services/<name>/`.

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Phase 1: Core Services | Hash, URL Shortener, Base64 deployable |
| 2 | Phase 1: Core Services | Markdown Renderer, Image Resize deployable |
| 3 | Phase 2: Monitoring & Utils | Cron Jobs, DNS Monitor deployable |
| 4 | Phase 2: Monitoring & Utils | Webhook Relay, YAML/JSON Tool deployable |
| 5 | Phase 3: Visual Services | QR Generator deployable |
| 6 | Phase 3: Visual Services | Image Editor deployable |
| 7 | Phase 4: BeckFlow | API gateway + basic workflow builder |
| 8 | Phase 4: BeckFlow | Full dashboard + pre-built workflows |
| 9 | Phase 5: Integration | Metrics, Grafana, rate limiting, TLS |
| 10 | Phase 5: Polish | Load testing, docs, launch |

---

## Testing Strategy

### Unit Tests (per service)
- Each Go service: `go test ./...` — covers all API endpoints
- Image editor: Jest tests for React components
- BeckFlow: React Testing Library for workflow builder

### Integration Tests
- End-to-end workflow execution: upload → resize → hash → QR → download
- Rate limiting: send 150 free-tier requests, verify 50 are rejected
- API key auth: valid key passes, invalid key gets 401

### Load Tests
- Hash service: 1000 req/sec (should handle easily)
- Image resize: 10 concurrent images (test memory pressure)
- BeckFlow: 50 concurrent workflow executions (test Redis + gateway)

---

## Launch Checklist

- [ ] All services pass `go test ./...`
- [ ] All deployments healthy (`kubectl rollout status`)
- [ ] TLS certificates issued (check cert-manager)
- [ ] Rate limiting active (test free tier limits)
- [ ] API key auth working (test paid tier)
- [ ] BeckFlow dashboard loads and builds a workflow
- [ ] Pre-built workflows execute successfully
- [ ] Prometheus metrics visible in Grafana
- [ ] Resource quotas enforced (test with high-usage workflow)
- [ ] Redis connection stable (no auth failures)
- [ ] 24h ephemeral storage expires correctly
- [ ] Load test passes (see above)
- [ ] Docs written (API reference, pricing page)
- [ ] Marketing post drafted (r/selfhosted, r/homelab)
- [ ] Founding member pricing set up (50% off first 10)

---

*End of project plans.*
*Next step: Create Workboard cards for each phase.*
