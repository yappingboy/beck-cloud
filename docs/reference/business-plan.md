# BeckCloud Business Plan

> "It's not a startup. It's a homelab with a price tag."

**Created:** 2026-07-23  
**Owner:** Stephen  
**Status:** Draft — ready for triage on the Workboard

---

## Executive Summary

BeckCloud is a homelab running ~45 services across a K3s cluster, backed by 140+ TB of storage and exposed to the internet via Traefik with SSO. The infrastructure already exists, already works, and is already overprovisioned for personal use. This plan identifies which services and capabilities can generate revenue without adding meaningful operational load.

**Core thesis:** The bottleneck isn't compute — it's attention. Every revenue stream should be "set it and forget it" after initial config. No new VMs, no new hardware, no new dependencies unless the ROI justifies it.

---

## Revenue Streams (Ranked by Effort → Revenue)

### Tier 1 — Almost Free (Deploy Once, Collect Forever)

#### 1. SaaS Hosting / PaaS for Indie Devs
**What:** Offer single-container hosting on the K3s cluster. Clients push a Docker image, get a domain, get SSO, get it.
**Why it works:** The cluster has ~15% CPU and ~47% RAM headroom. The Traefik ingress, cert-manager, and SSO chains are already built. This is literally what Kubernetes was designed for.
**Price:** $5–15/month per container. Tiered by resource allocation.
**Target:** Indie devs, small projects, hobby apps that don't want Heroku's $25/mo minimum.
**Effort:** ~2 hours to build a simple deploy webhook + resource quota system. ~5 min/month maintenance.
**Risks:** Node RAM usage would climb from 53% → potentially 70-80% depending on client appetite. Worker node has 44 GiB RAM — headroom is real.
**Differentiation:** "The homelab that punches above its weight." Personal support, not a ticketing queue.

#### 2. Static Site Hosting
**What:** Push HTML/CSS/JS to a git repo, get a hosted site with free TLS. Think Netlify but for one server.
**Why it works:** The landing page already runs on Node/Alpine. Traefik handles routing. Cert-manager handles TLS. This is maybe 20 lines of YAML plus a webhook.
**Price:** $2–5/month per site. Or free for <50MB sites (builds in with no extra cost).
**Target:** Portfolio sites, project docs, landing pages, personal blogs.
**Effort:** ~1 hour (Kaniko build pods already exist in the toolbox namespace).
**Differentiation:** Fast builds, cheap, personal touch.

#### 3. API Proxy / URL Shortener / Redirect Service
**What:** A minimal service that handles URL shortening, API proxying, or redirect management.
**Why it works:** Traefik middleware chain is already doing this for SSO. One more middleware = one more service. The `landing` namespace/app is already running.
**Price:** $1–3/month. Or free tier up to 10k requests.
**Target:** Developers, bloggers, small businesses.
**Effort:** ~1 hour (pick a lightweight tool — maybe Rebrandly clone or a simple Go binary).
**Differentiation:** "Your own branded URL shortener without the Google dependency."

### Tier 2 — Moderate Setup, Low Maintenance

#### 4. Media Streaming (Jellyfin)
**What:** Expose Jellyfin to the internet. 45TB of anime, movies, and TV shows.
**Why it works:** Jellyfin already runs with 45TiB per library. Bandwidth is the only constraint — need to check ISP upload speed and data caps.
**Price:** $3–8/month per household. Family plans for $12/month.
**Target:** Anime fans (the library is specifically called "media-anime"), people who've been burned by Netflix price hikes.
**Effort:** ~30 minutes to create IngressRoute + set bandwidth limits.
**Risks:** Upload bandwidth. If the ISP has a 1TB monthly cap, 45TB of content is useless for streaming. **Must verify upload speed and data cap before launching.**
**Differentiation:** Curated anime library + SSO. Not just another Plex clone.

#### 5. 3D Printing Services (Manyfold + Gridspace)
**What:** Cloud platform for 3D printing — manage models, track filament, slice prints, generate meshes.
**Why it works:** Five services already deployed: Manyfold (model library), FDM Monster (slicer), Spoolman (filament tracker), OrcaSlicer (cloud slicing), BumpMesh (mesh generation). Plus a custom Gridspace platform. This is a complete 3D printing stack.
**Price:** 
- Manyfold: Free for <100 models, $5/month for unlimited
- FDM Monster: $3/month (slicing compute is basically free)
- Gridspace: $5/month (custom platform = premium)
**Target:** 3D printing community, maker spaces, design studios.
**Effort:** ~2 hours for IngressRoutes + SSO integration.
**Differentiation:** One platform for the entire 3D print workflow. Nobody else does this.

#### 6. Email Relay / Transactional Email
**What:** Postfix relay with Mailgun API. Send transactional emails for small apps.
**Why it works:** Postfix-relay is already deployed in the identity namespace. Mailgun API is already configured. This is zero new infrastructure.
**Price:** $2–10/month based on volume (1k–50k emails/month).
**Target:** Indie devs, small SaaS apps, newsletter creators.
**Effort:** ~30 minutes to expose via IngressRoute + API endpoint.
**Risks:** IP reputation needs monitoring. Crowdsec WAF is already protecting the endpoint.

### Tier 3 — Higher Effort, Higher Reward

#### 7. Managed Kubernetes (K3s-as-a-Service)
**What:** Spin up small K3s clusters for clients who want Kubernetes but not the complexity.
**Why it works:** OpenNebula is already managing VMs. Ansible playbooks deploy the full stack. This is the most "production" capability on the rack.
**Price:** $25–75/month per cluster.
**Target:** Learning Kubernetes, small teams, proof-of-concept projects.
**Effort:** ~4 hours to automate cluster creation + billing portal.
**Risks:** Storage contention. 45TiB per library is shared with clients.
**Differentiation:** "Get a real K3s cluster in 5 minutes, not 5 hours."

#### 8. LLM API Endpoint
**What:** Expose the llama.cpp instance (172.16.0.7:8088) as a gpt-compatible API.
**Why it works:** Ollama/llama.cpp is already running on the LAN. The `llm` namespace has a service pointing to it. Just need an API gateway with rate limiting.
**Price:** $5–20/month based on token usage.
**Target:** Developers who want local-model inference without running their own GPU.
**Effort:** ~2 hours (ollama API is already compatible with OpenAI format).
**Risks:** GPU memory is the constraint. Whatever GPU is on 172.16.0.7 determines model size and concurrency.

#### 9. Home Automation Hosting (Home Assistant)
**What:** Host Home Assistant for people who don't want to run it on their own hardware.
**Why it works:** Home Assistant is already deployed with SSO. The config PVC is 5 GiB — plenty for one household.
**Price:** $5–10/month.
**Target:** Non-technical people who want HA but not the setup hassle. Smart home renters.
**Effort:** ~30 minutes (IngressRoute already exists for `ha.becklab.cloud`).
**Differentiation:** Admin SSO + backup included. Not just a raw HA instance.

#### 10. Game Server Hosting (Minecraft)
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
| Static Sites | ~1 | $10–50 | <5 min | ★★★★ |
| URL Shortener | ~1 | $5–20 | <5 min | ★★★★ |
| Email Relay | ~0.5 | $10–50 | <5 min | ★★★★★ |
| Jellyfin | ~0.5 | $20–80 | 15 min | ★★★ |
| 3D Printing | ~2 | $15–60 | 10 min | ★★★ |
| SaaS Hosting | ~2 | $25–150 | 30 min | ★★ |
| LLM API | ~2 | $20–100 | 10 min | ★★★ |
| HA Hosting | ~0.5 | $10–40 | 10 min | ★★★ |
| Minecraft | ~0.5 | $10–60 | 30 min | ★★ |
| K3s-as-a-Service | ~4 | $25–300 | 1 hr | ★ |

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
| Bandwidth | TBD | Depends on ISP | Critical for Jellyfin/LLM |
| IPs | 2 nodes | Depends on NAT | Port forwarding for Minecraft |
| Domains | becklab.cloud wildcard | Unlimited subdomains | Free — already own it |

**Key constraint:** Upload bandwidth. Before launching any external-facing service, check:
1. ISP upload speed (Mbps)
2. Monthly data cap (TB)
3. Whether the ISP blocks common ports (80, 443, 25, etc.)
4. Whether the IP is dynamic (need DynDNS?)

---

## Go-to-Market

### Phase 1: Quiet Launch (Month 1)
- Deploy URL shortener and static site hosting
- List on r/selfhosted, r/homelab, Hacker News "Who's hosting?" threads
- Offer 3 free spots for beta testers (gets testimonials)
- Price: First 5 customers at 50% off forever

### Phase 2: Content Push (Month 2-3)
- Write a blog post: "How I turned my homelab into a $200/month side business"
- Deploy Jellyfin + 3D printing IngressRoutes
- Post on anime communities, r/3Dprinting
- Offer affiliate codes for first 3 months

### Phase 3: Scale (Month 4+)
- Add SaaS hosting portal with resource quotas
- Deploy LLM API endpoint
- Write follow-up: "From 3 customers to 30 — lessons running a homelab business"
- Evaluate whether to add a second worker node or upgrade RAM

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
| ISP data cap hit | High (if streaming) | High | Bandwidth limits per customer, $/GB overage |
| Hardware failure (one node) | Low-Medium | High | Worker can handle all workloads with reduced capacity |
| Customer churn | Medium | Low | Low prices = low churn commitment. Easy to replace 1 customer. |
| Port blocking by ISP | Medium | Medium | Use Cloudflare Tunnel for fallback routing |
| IP blacklisted by Crowdsec | Low | Medium | Monitor; whitelist known customers |
| RAM exhaustion on worker | Low | Medium | Resource quotas per client, 17 GiB headroom |

---

## Not Currently Viable

| Stream | Why Not |
|--------|---------|
| Video transcoding (Tdarr) | Needs GPU, single-node bottleneck |
| Managed Postgres (Directus/PostgreSQL) | PVC contention, no HA |
| Slack/Discord bots | Token management overhead |
| NFT marketplace | Because really? |
| Crypto mining | Electricity ROI doesn't justify it |
| CDN | Only 2 IPs, limited edge presence |

---

*End of business plan.*
*Next step: Triage on Workboard → pick one Tier 1 stream to implement first.*
