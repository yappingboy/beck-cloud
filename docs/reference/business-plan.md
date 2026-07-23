# BeckCloud Business Plan

> "It's not a startup. It's a homelab with a price tag."

**Created:** 2026-07-23  
**Owner:** Stephen  
**Status:** Draft — ready for triage on the Workboard

---

## Executive Summary

BeckCloud is a homelab running ~45 services across a K3s cluster, backed by 140+ TB of storage and exposed to the internet via Traefik with SSO. The infrastructure already exists, already works, and is already overprovisioned for personal use. This plan identifies which services and capabilities can generate revenue without adding meaningful operational load.

**Core thesis:** The bottleneck isn't compute — it's attention. Every revenue stream should be "set it and forget it" after initial config. No new VMs, no new hardware, no new dependencies unless the ROI justifies it.

**Key constraints from initial review:**
- Jellyfin streaming is out (licensing)
- Email relay is out (spam-host risk with current IP reputation)
- RTX Titan GPU (24GB VRAM) = 1 concurrent session max at full quality
- 3D printing: shift from "print on demand" to BYOD (Bring Your Own Device) platform

---

## Revenue Streams (Ranked by Effort → Revenue)

### Tier 1 — Middleware & Tiny Services (Fistful of Micro-Products)

> The pattern: lightweight, single-purpose, already-built infrastructure. Each is a Traefik middleware chain + a small service or binary. Low RAM, low CPU, high margin.

#### 1. Static Site Hosting
**What:** Push HTML/CSS/JS to a git repo, get a hosted site with free TLS. Think Netlify but for one server.
**Why it works:** The landing page already runs on Node/Alpine. Traefik handles routing. Cert-manager handles TLS. Kaniko build pods exist in the toolbox namespace. Maybe 20 lines of YAML plus a webhook.
**Price:** $2–5/month per site. Or free for <50MB sites (builds in with no extra cost).
**Target:** Portfolio sites, project docs, landing pages, personal blogs.
**Effort:** ~1 hour (Kaniko build pods already exist in the toolbox namespace).
**Differentiation:** Fast builds, cheap, personal touch.

#### 2. URL Shortener
**What:** A branded URL shortener. Each customer gets their own prefix.
**Why it works:** Traefik middleware chain is already doing proxying and redirects. One more middleware = one more service. A simple Go binary (e.g., `short` or `msh`) is ~5MB, ~5MB RAM.
**Price:** $1–3/month. Or free tier up to 10k clicks.
**Target:** Bloggers, marketers, developers who don't want Linktree.
**Effort:** ~1 hour.
**Differentiation:** Custom domain support, analytics dashboard, no account required for basic use.

#### 3. Hash Function as a Service
**What:** HTTP endpoints for SHA-256, HMAC-SHA256, md5sum, base64 encode/decode. Think `https://hash.becklab.cloud/?algo=sha256&input=hello`.
**Why it works:** Zero dependencies. One tiny binary. Responds in <1ms. RAM footprint <2MB. You can run 100 instances of this and the worker won't notice.
**Price:** $1/month for premium (API keys, rate limits, webhook notifications on hash collisions).
**Target:** Devs who need quick hashing in CI/CD pipelines, scripts, automation.
**Effort:** ~30 minutes.

#### 4. Cron Job Service
**What:** HTTP-triggered cron jobs. Clients register an endpoint, set a schedule, and you hit it.
**Why it works:** `cron` is built into Linux. One process, tiny footprint. The real value is the web dashboard (list active schedules, trigger manually, view logs).
**Price:** $2–5/month based on job count (5–50 jobs).
**Target:** Indie devs who need scheduled webhooks (API rate limits, cleanup tasks, report generation).
**Effort:** ~2 hours for the dashboard.
**Differentiation:** Simple, cheap, reliable. No Docker needed.

#### 5. Image Resize / WebP Converter
**What:** Upload an image, get it resized/compressed/converted to WebP. HTTP API: `POST /resize?url=...&width=800&height=600`.
**Why it works:** `imagemagick` or `sharp` binary, minimal overhead. The real cost is disk I/O, not CPU. One instance handles maybe 50 req/min before anyone notices.
**Price:** $2–5/month. $0.001 per image over free tier (100/month).
**Target:** Bloggers, API consumers, small SaaS apps needing on-the-fly image optimization.
**Effort:** ~2 hours.

#### 6. Markdown → HTML / PDF / PNG Renderer
**What:** POST markdown, get rendered HTML, PDF, or PNG back. Think a self-hosted Markdown API.
**Why it works:** `pandoc` or `marked` binary. Instant response. Zero storage cost (stateless).
**Price:** $2–5/month.
**Target:** Documentation sites, blog engines, Notion-to-web exporters.
**Effort:** ~1 hour.

#### 7. DNS Lookup / Health Check Service
**What:** HTTP endpoints for DNS lookups (A, MX, TXT, CNAME), HTTP health checks, TLS certificate inspection.
**Why it works:** One binary, one config. The real value is the dashboard showing historical check results and uptime.
**Price:** $1–3/month for the monitoring dashboard.
**Target:** DevOps engineers, small ops teams, status page owners.
**Effort:** ~2 hours for the dashboard.

#### 8. Webhook Relay / Bounce Service
**What:** Receive webhooks, store them, replay them, retry on failure. Think Sentry's webhook handler but standalone.
**Why it works:** Lightweight Go binary (e.g., `ngrok` server-mode or `webhook` by adnanh). Redis for queue storage (already deployed in identity ns).
**Price:** $3–8/month based on webhook volume.
**Target:** Devs who need reliable webhook delivery for GitHub/GitLab/Stripe events.
**Effort:** ~3 hours for the dashboard.

#### 9. YAML/JSON Diff / Validator / Formatter
**What:** POST yaml/json, get back formatted output, diff against another file, or validate against a schema.
**Why it works:** `yq`, `jq`, `jsonschema` binaries. Stateless. Sub-millisecond responses.
**Price:** Free tier + $2/month for schema validation (JSON Schema, OpenAPI).
**Target:** DevOps, Kubernetes users, API developers.
**Effort:** ~1 hour.

#### 10. Base64 / URL Encode / Hex Converter
**What:** Simple encoding/decoding service. Base64, URL encode/decode, hex to ASCII, ASCII to hex.
**Why it works:** One binary, <1MB RAM. Can serve thousands of requests per second.
**Price:** Free. ($1/month for branded custom domain per customer.)
**Target:** Devs, sysadmins, anyone who needs quick conversions.
**Effort:** ~30 minutes.

### Tier 1b — Bundled Offer: "BeckCloud Micro"

Bundle 3+ of the above into a single subscription. Most customers want 2–3 services; bundling increases perceived value without increasing marginal cost.

| Tier | Price | What's Included |
|------|-------|----------------|
| Starter | $3/mo | Static sites + URL shortener + hash service |
| Builder | $7/mo | All of Starter + cron jobs + image resize + markdown renderer |
| Pro | $12/mo | Everything + webhook relay + DNS monitor + priority support |

---

### Tier 2 — OpenNebula Hypervisor Space + SaaS Hosting

#### 11. OpenNebula VM Hosting (Hypervisor-as-a-Service)
**What:** Spin up small VMs on the AlmaLinux hypervisor. Not containers — real VMs with their own OS, network namespace, and isolation.
**Why it works:** OpenNebula is already managing VMs. Ansible playbooks (`04-one-vms.yml`) create VMs from templates. Each VM is a proper machine — Docker, Node, Python, whatever. Better isolation than containers, better than most VPS providers.
**Specs per VM:**
- **Micro** (shared): 1 vCPU, 1 GiB RAM, 10 GiB disk — $3/month
- **Small** (dedicated): 2 vCPU, 2 GiB RAM, 20 GiB disk — $7/month
- **Medium** (dedicated): 4 vCPU, 4 GiB RAM, 40 GiB disk — $15/month
- **Large** (dedicated): 8 vCPU, 8 GiB RAM, 80 GiB disk — $25/month
**Why customers choose this over containers:** Full OS control, root access, system-level packages, kernel modules, Docker-in-Docker.
**Effort:** ~3 hours for the VM portal (simple dashboard showing running VMs, start/stop/reboot, console access).
**Risks:** VM count vs RAM. At 4 GiB per medium VM, 4 VMs = 16 GiB = all worker headroom. **Resource cap: 4 medium VMs or equivalent.**
**Differentiation:** "Real VMs, not containers. Full root access. $3/mo."

#### 12. SaaS Hosting / PaaS for Indie Devs
**What:** Offer single-container hosting on the K3s cluster. Clients push a Docker image, get a domain, get SSO, get it.
**Why it works:** The cluster has ~15% CPU and ~47% RAM headroom. The Traefik ingress, cert-manager, and SSO chains are already built. Resource quotas limit each client.
**Price:** $5–15/month per container. Tiered by resource allocation.
**Target:** Indie devs, small projects, hobby apps that don't want Heroku's $25/mo minimum.
**Effort:** ~2 hours to build a simple deploy webhook + resource quota system. ~5 min/month maintenance.
**Risks:** Worker RAM from 53% → potentially 70-80%. 44 GiB RAM = headroom is real but finite.
**Differentiation:** "The homelab that punches above its weight." Personal support, not a ticketing queue.

#### 13. Managed Kubernetes (K3s-as-a-Service)
**What:** Spin up small K3s clusters for clients who want Kubernetes but not the complexity.
**Why it works:** Ansible playbooks deploy the full stack (`05-k3s.yml`). One script, one cluster.
**Price:** $25–75/month per cluster.
**Target:** Learning Kubernetes, small teams, proof-of-concept projects.
**Effort:** ~4 hours to automate cluster creation + billing portal.
**Risks:** Storage contention. 45TiB per library is shared with clients.
**Differentiation:** "Get a real K3s cluster in 5 minutes, not 5 hours."

---

### Tier 3 — Moderate Effort, Specific Value

#### 14. 3D Printing — BYOD (Bring Your Own Device) Platform
**What:** Cloud platform for 3D printing workflow — manage models, track filament, slice prints, generate meshes. Instead of printing on-site, users configure their own printer connections.

**How it scales:**
- **FDM Monster** → Cloud slicing. Users upload STLs, you slice them in the cloud, they download G-code for their own printer. Zero hardware dependency.
- **Manyfold** → Model library. Host models for others, or let users host their own. Free tier: 50 models. Paid: unlimited.
- **Spoolman** → Filament tracking. Users log their spools, you show usage analytics.
- **OrcaSlicer** → Cloud slicing via OrcaSlicer's headless mode. Users slice in-browser, download G-code.
- **BumpMesh** → Mesh generation. Upload photos, get 3D models back.
- **Gridspace** → Custom browser-based 3D design tool. Users design in-browser.

**Pricing:**
- Manyfold: Free <50 models, $5/month unlimited
- FDM Monster slicing: $3/month (slicing compute is ~zero marginal cost)
- Spoolman: Free, $3/month for analytics dashboard
- Gridspace: $5/month (custom platform)
- Bundle: $10/month for all four

**Target:** 3D printing community, makers, design studios who already own printers but want better management.

**Effort:** ~2 hours for IngressRoutes + SSO integration. ~4 hours for the "BYOD" dashboard.

**Differentiation:** One platform for the entire 3D print workflow. Nobody else does this at this price.

**Old Printer Option:** Keep the physical printer for local "print on demand" — $0.10–0.30 per gram of PLA. Niche but high-margin.

#### 15. LLM API Endpoint (RTX Titan 24GB)
**What:** Expose the RTX Titan (24GB VRAM) as an OpenAI-compatible API endpoint.
**Why it works:** llama.cpp + RTX Titan = serious inference power. 24GB VRAM can run a 70B-parameter model (quantized) or multiple 13B models concurrently. The `llm` namespace already has the service pointing to 172.16.0.7:8088.
**Realistic concurrency:** 1 session at full quality, or 2–3 sessions at reduced context/window. The RTX Titan handles 70B-Q4 (4-bit quantized) at ~8-12 tokens/sec.
**Price:** 
- $5/month: 100K tokens/mo (casual use)
- $15/month: 1M tokens/mo (heavy use)
- $30/month: Unlimited + priority queue
**Target:** Developers who want local-model quality without running their own GPU.
**Effort:** ~2 hours (ollama API is already OpenAI-compatible).
**Risks:** One concurrent session at best. Queue-based delivery. A customer who runs a long generation blocks everyone.
**Differentiation:** "70B model quality at $5/mo. Your own GPT-4 equivalent."

#### 16. Email Relay / Transactional Email (with Mailgun relay)
**What:** Postfix relay with Mailgun API. Send transactional emails for small apps.
**Why it works:** Postfix-relay is already deployed in the identity namespace. Mailgun API is already configured. Zero new infrastructure.
**Price:** $2–10/month based on volume (1k–50k emails/month).
**Target:** Indie devs, small SaaS apps, newsletter creators.
**Effort:** ~30 minutes to expose via IngressRoute + API endpoint.
**Risks:** IP reputation needs monitoring. Crowdsec WAF is already protecting the endpoint. **Note: Current IP reputation is unknown — monitor bounce rates closely on launch.**

#### 17. Home Assistant Hosting
**What:** Host Home Assistant for people who don't want to run it on their own hardware.
**Why it works:** Home Assistant is already deployed with SSO. The config PVC is 5 GiB — plenty for one household.
**Price:** $5–10/month.
**Target:** Non-technical people who want HA but not the setup hassle. Smart home renters.
**Effort:** ~30 minutes (IngressRoute already exists for `ha.becklab.cloud`).
**Differentiation:** Admin SSO + backup included. Not just a raw HA instance.

#### 18. Game Server Hosting (Minecraft)
**What:** Minecraft server via Crafty Controller. Public-facing with NodePort :31337.
**Why it works:** Already deployed, already has a NodePort. Crafty Controller handles server management.
**Price:** $5–15/month per server.
**Target:** Minecraft communities, Discord servers, friends.
**Effort:** ~30 minutes for public DNS + whitelisting.
**Risks:** CPU/RAM intensive. A single modded server can eat 4+ cores.

---

## Quick-Start Priority Matrix

| Stream | Setup Hours | Monthly Revenue | Effort/Month | Revenue/Hour |
|--------|-------------|-----------------|--------------|--------------|
| Hash Service | ~0.5 | $5–20 | <5 min | ★★★★ |
| URL Shortener | ~1 | $5–20 | <5 min | ★★★★ |
| Base64/Converter | ~0.5 | $3–15 | <5 min | ★★★★ |
| Static Sites | ~1 | $5–30 | <5 min | ★★★★ |
| Email Relay | ~0.5 | $5–30 | <5 min | ★★★★★ |
| Markdown Renderer | ~1 | $5–25 | <5 min | ★★★ |
| Image Resize | ~2 | $5–30 | <5 min | ★★★ |
| DNS Monitor | ~2 | $5–20 | <10 min | ★★★ |
| YAML/JSON Tool | ~1 | $5–20 | <5 min | ★★★ |
| 3D Printing (BYOD) | ~2 | $10–50 | 10 min | ★★★ |
| LLM API (RTX Titan) | ~2 | $15–90 | 10 min | ★★★ |
| Cron Service | ~2 | $10–40 | <10 min | ★★★ |
| Webhook Relay | ~3 | $10–50 | <15 min | ★★★ |
| OpenNebula VMs | ~3 | $12–100 | 30 min | ★★ |
| SaaS Hosting | ~2 | $15–90 | 30 min | ★★ |
| K3s-as-a-Service | ~4 | $25–225 | 1 hr | ★ |

---

## Infrastructure Capacity Check

| Resource | Current | Headroom | What It Buys |
|----------|---------|----------|--------------|
| CPU (server) | 8% | 92% | ~50 more containers easily |
| CPU (worker) | 14% | 86% | ~30 more containers |
| RAM (server) | 39% | 61% | ~8 GiB more |
| RAM (worker) | 53% | 47% | ~17 GiB more |
| Storage (local-path) | ~55 PVCs | Varies | PVC quota per client: 5–10 GiB |
| Storage (LVM) | 140+ TiB | Massive | Shared with clients if needed |
| Bandwidth | TBD | Depends on ISP | Critical for streaming/LLM |
| IPs | 2 nodes | Depends on NAT | Port forwarding for MC |
| GPU | RTX Titan 24GB | 1 session max | LLM API endpoint |
| VMs (OpenNebula) | 2 K3s VMs | 4–6 more VMs | Hypervisor-as-a-Service |
| Domains | becklab.cloud wildcard | Unlimited subdomains | Free — already own it |

**Key constraints:**
1. **Upload bandwidth** — check ISP speed and data cap before launching anything bandwidth-heavy
2. **GPU concurrency** — RTX Titan = 1 session max at full quality, queue-based for others
3. **Worker RAM** — 44 GiB total, currently at 23 GiB. VMs eat RAM fast (each medium = 4 GiB)
4. **IP reputation** — unknown for email; monitor bounce rates closely

---

## Go-to-Market

### Phase 1: Quiet Launch (Month 1)
- Deploy 5 micro-services: hash, URL shortener, base64 converter, static sites, markdown renderer
- List on r/selfhosted, r/homelab, Hacker News "Who's hosting?" threads
- Offer "Founding Member" pricing: 50% off forever for first 10 customers
- Bundle as "BeckCloud Micro" ($3/mo starter tier)

### Phase 2: Expand (Month 2-3)
- Add cron service, image resize, DNS monitor, webhook relay
- Launch OpenNebula VM hosting with 2–3 VM templates
- Deploy 3D printing BYOD IngressRoutes
- Write a blog post: "10 micro-services, $0 new hardware, $50/mo revenue"

### Phase 3: Scale (Month 4+)
- Add SaaS hosting portal with resource quotas
- Deploy LLM API endpoint (RTX Titan — market it hard: "70B models at $5/mo")
- Write follow-up: "From 5 customers to 50 — lessons running a homelab business"
- Evaluate whether to add a second worker node or upgrade RAM

### Marketing Hooks
- "10 micro-services, one server, zero new hardware"
- "70B-parameter models at $5/mo (RTX Titan 24GB)"
- "Real VMs, not containers. Full root access. $3/mo."
- "Your own branded URL shortener. No ads. No tracking. $1/mo."
- "The homelab that pays for itself."

---

## Brand Positioning

**BeckCloud isn't another VPS provider.** The positioning is:

> **"Small enough that you'll get a real response. Big enough that it just works."**

Key selling points:
- Personal support (no ticketing queue, no 48-hour response SLA)
- Overprovisioned infrastructure (your traffic spike won't matter)
- Everything self-hosted (no AWS bill surprises, no ToS changes)
- GitOps deployments (your config is versioned, reproducible, in git)
- SSO everywhere (one login for everything, backed by Keycloak)
- Real VMs on bare metal (not containers in a container)

---

## Expenses

| Item | Monthly | Notes |
|------|---------|-------|
| Electricity | ~$15–25 | Depends on actual draw |
| ISP | ~$50–80 | Broadband bill |
| Domain | ~$12/year | becklab.cloud |
| Certificates | $0 | Let's Encrypt free |
| Mailgun (email) | ~$15/month | First 10k free, then pay-per-use |
| Turso (optional) | $0–5/month | If Swiparr migrates to Turso |
| **Total** | **~$80–120** | Revenue starts offsetting immediately |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ISP uptime drops | Medium | High | Keep personal access; customers don't need 99.99% |
| ISP data cap hit | High (if streaming/LLM) | High | Bandwidth limits per customer, $/GB overage |
| GPU blocks on long runs | Medium | Medium | Queue system, max duration per customer, priority tiers |
| Hardware failure (one node) | Low-Medium | High | Worker can handle all workloads with reduced capacity |
| Customer churn | Medium | Low | Low prices = low churn commitment. Easy to replace 1 customer. |
| IP blacklisted by email providers | Medium | High | Monitor bounce rates; use Mailgun relay as backup |
| RAM exhaustion on worker | Low | Medium | Resource quotas per client, 17 GiB headroom |
| Port blocking by ISP | Medium | Medium | Cloudflare Tunnel for fallback routing |

---

## Not Currently Viable

| Stream | Why Not |
|--------|---------|
| Jellyfin streaming | Licensing constraints |
| Email relay (direct) | Spam-host risk with current IP reputation |
| Video transcoding (Tdarr) | Needs GPU, single-node bottleneck |
| Managed Postgres (Directus/PostgreSQL) | PVC contention, no HA |
| Slack/Discord bots | Token management overhead |
| NFT marketplace | Because really? |
| Crypto mining | Electricity ROI doesn't justify it |
| CDN | Only 2 IPs, limited edge presence |

---

*End of business plan.*
*Next step: Triage on Workboard → pick Tier 1 micro-services to implement first.*
