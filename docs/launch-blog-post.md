# BeckLab Tools: Self-Hosted Micro-Services for Developers

**Draft for r/selfhosted, r/homelab, Hacker News**

---

Hey everyone — I built BeckLab Tools, a suite of 10 self-hosted micro-services designed for developers who want reliable, fast APIs without the SaaS overhead.

## What it is

BeckLab Tools is a collection of lightweight, purpose-built services running on Kubernetes:

| Service | Endpoint | What it does |
|---------|----------|--------------|
| **Hash** | hash.tools.becklab.cloud | SHA-256, SHA-512, HMAC, MD5, Base64, Hex |
| **URL Shortener** | short.tools.becklab.cloud | Create/redirect/tracked links with expiry |
| **Converter** | convert.tools.becklab.cloud | Base64, URL, HTML, ROT13, UUID, random strings |
| **Cron Jobs** | cron.tools.becklab.cloud | Schedule HTTP jobs with persistence |
| **DNS Monitor** | dns.tools.becklab.cloud | DNS lookups, HTTP health checks, TLS cert inspection |
| **Webhook Relay** | webhook.tools.becklab.cloud | Fan-out webhooks to multiple endpoints |
| **YAML/JSON Tool** | fmt.tools.becklab.cloud | Format, convert, validate, diff JSON/YAML |
| **QR Generator** | qr.tools.becklab.cloud | QR codes with WiFi, vCard, email templates |
| **Image Editor** | editor.tools.becklab.cloud | Browser-based canvas editor + API |
| **BeckFlow** | dashboard.tools.becklab.cloud | Multi-step workflow orchestration across all services |

## Why I built it

Every service is a single Go binary under 10MB. They run on a home lab K3s cluster with resource quotas, auto-scaling readiness, and Prometheus metrics. No bloat, no Node.js dependencies, no Docker-in-Docker nonsense.

Each service:
- Responds in <50ms
- Exposes `/metrics` for Prometheus
- Has liveness/readiness probes
- Runs as non-root with security contexts
- Costs pennies to run

## Pricing

Free tier available (10 req/min). Paid plans start at $3/mo for 60 req/min. Founding members (first 10) get 50% off locked in for life.

## Tech stack

- **Services:** Go 1.22, single binary, no CGO
- **Orchestration:** K3s + Flux GitOps
- **Ingress:** Traefik with rate limiting middleware
- **TLS:** cert-manager + Let's Encrypt wildcard
- **Monitoring:** Prometheus + Grafana
- **Auth:** JWT + Redis API key system
- **Registry:** GitHub Container Registry

## Check it out

- **API Reference:** tools.becklab.cloud/docs
- **Status Page:** tools.becklab.cloud/status
- **Pricing:** tools.becklab.cloud/pricing

Happy to answer any questions about the architecture, the pricing model, or the self-hosting setup.

---

*Cross-post friendly. I'm the solo dev behind this — no VC, no employees, just a homelab and too much free time.*
