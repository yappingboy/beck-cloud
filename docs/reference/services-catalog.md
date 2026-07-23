# Services Catalog — Detailed Reference

**Last audited:** 2026-07-20  
**Scope:** Every running service with operational details, ports, config locations, and access patterns

---

## 3D Printing Namespace (`3dprinting`)

> New deployment ~2026-07-16. Complete 3D printing management stack.

### Manyfold (Print Management)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/manyfold3d/manyfold:latest` |
| Database | PostgreSQL 17 (manyfold-db, 50 GiB libraries PVC) |
| Cache | Valkey 8 (Redis-compatible, manyfold-redis) |
| Config PVC | 5 GiB local-path |
| Libraries PVC | 50 GiB local-path |
| Status | ✅ Running |

### FDM Monster (Slicer & Print Profiles)
| Property | Value |
|----------|-------|
| Image | `docker.io/fdmmonster/fdm-monster:latest` |
| Database PVC | 5 GiB local-path |
| Media PVC | 5 GiB local-path |
| Status | ✅ Running |

### Spoolman (Filament Tracking)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/donkie/spoolman:latest` |
| Data PVC | 2 GiB local-path |
| Status | ✅ Running |

### OrcaSlicer (Cloud Slicing)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/linuxserver/orcaslicer:latest` |
| Config PVC | 5 GiB local-path |
| Status | ✅ Running |

### BumpMesh (Mesh Generation)
| Property | Value |
|----------|-------|
| Image | `docker.io/library/nginx:alpine-slim` |
| HTML PVC | 200Mi local-path |
| Status | ✅ Running |

---

## Gridspace Namespace (`gridspace`)

> New deployment ~2026-07-16. Custom 3D design platform.

### Gridspace
| Property | Value |
|----------|-------|
| Image | `ghcr.io/yappingboy/becklab-gridspace:latest` |
| Data PVC | 2 GiB local-path |
| URL | `gridspace.becklab.cloud` (custom app — no SSO) |
| Status | ✅ Running |

### Kiri:moto (Texture Generation)
| Property | Value |
|----------|-------|
| URL | `kiri.becklab.cloud` |
| IngressRoute | `kiri-moto` (middleware: `gridspace-kiri-root-redirect`) |
| TLS | `kiri-tls` (expires 2026-10-13) |
| Status | ✅ Running |

### Mesh Tool
| Property | Value |
|----------|-------|
| URL | `mesh.becklab.cloud` |
| IngressRoute | `mesh-tool` (middleware: `gridspace-mesh-root-redirect`) |
| TLS | `mesh-tls` (expires 2026-10-13) |
| Status | ✅ Running |

### Void:Form
| Property | Value |
|----------|-------|
| URL | `void.becklab.cloud` |
| IngressRoute | `void-form` (middleware: `gridspace-void-root-redirect`) |
| TLS | `void-tls` (expires 2026-10-13) |
| Status | ✅ Running |

---

## Identity & Authentication Namespace (`identity`)

### Keycloak (IdP)
| Property | Value |
|----------|-------|
| Image | `quay.io/keycloak/keycloak:26.0` |
| Database | PostgreSQL via StatefulSet (10 GiB PVC) |
| Realm | `homelab` |
| Federation | LDAP → LLDAP at `ldap://lldap.identity.svc.cluster.local:389` |
| Status | ✅ Running — healthy (0 recent restarts) |

### LLDAP (User Directory)
| Property | Value |
|----------|-------|
| Image | `lldap/lldap:stable` |
| LDAP port | 389/TCP (cluster-internal) |
| Web UI port | 17170/TCP |
| Storage | 5 GiB local-path PVC |
| Groups | `/admins`, `/media` |
| Status | ✅ Running |

### oauth2-proxy (Admin Tier)
| Property | Value |
|----------|-------|
| Image | `quay.io/oauth2-proxy/oauth2-proxy:v7.6.0` |
| Helm chart | oauth2-proxy v7.6.0 |
| Provider | Keycloak OIDC (`homelab` realm) |
| Session store | Redis (local STS, 1 GiB PVC) |
| Group requirement | `/admins` |
| Status | ✅ Running — **FIXED** (was CrashLoopBackOff on 2026-07-12) |

### oauth2-proxy-media (Media Tier)
| Property | Value |
|----------|-------|
| Image | `quay.io/oauth2-proxy/oauth2-proxy:v7.6.0` |
| Helm chart | oauth2-proxy v7.6.0 |
| Provider | Keycloak OIDC (`homelab` realm) |
| Session store | Redis (shared with admin tier) |
| Group requirement | `/media` |
| Status | ✅ Running — **FIXED** (was CrashLoopBackOff on 2026-07-12) |

### Supporting Services
- **logout-page** — nginx:alpine serving logout landing page
- **sso-redirect** — nginx:1.27-alpine, catches 401 errors and redirects to Keycloak login
- **user-invite** — Custom Python app (`ghcr.io/yappingboy/becklab-user-invite:v4.1783837566`) for user provisioning — **UPGRADED** from v1
- **postfix-relay** — `mwader/postfix-relay:latest`, Mailgun API relay (moved from `email` namespace)

---

## Webapps Namespace (`webapps`)

> New consolidation namespace ~2026-07-15. Most user-facing web services migrated here from their individual namespaces.

### Affine Server
| Property | Value |
|----------|-------|
| Image | `ghcr.io/toeverything/affine:stable` |
| Port | 3010/TCP |
| URL | `affine.becklab.cloud` (admin SSO) |
| Config PVC | 1 GiB local-path |
| Storage PVC | 20 GiB local-path |
| PostgreSQL | pgvector:pg16 (10 GiB PVC) |
| Redis | redis:7-alpine |
| Status | ✅ Running |

### Bitwarden Secrets Manager
| Property | Value |
|----------|-------|
| Image | `vaultwarden/server:latest` |
| Port | 80/TCP (internal) |
| Config PVC | 10 GiB local-path |
| URL | `bw.becklab.cloud` (no SSO — Vaultwarden's own auth) |
| Status | ✅ Running |

### Directus 11
| Property | Value |
|----------|-------|
| Image | `directus/directus:11` |
| Port | 8055/TCP |
| Config PVC | 2 GiB local-path |
| URL | `cms.becklab.cloud` (admin SSO) |
| Status | ✅ Running |

### Home Assistant
| Property | Value |
|----------|-------|
| Image | `ghcr.io/home-assistant/home-assistant:stable` |
| Config PVC | 5 GiB local-path |
| URL | `ha.becklab.cloud` (admin SSO via `sso-admin-chain-no-auth-header`) |
| Special routes | `/esphome` (ESPHome strip-prefix), `/mqtt` (MQTT strip-prefix), `/api/websocket` |
| Status | ✅ Running — 4/4 containers ready |

### Homepage (Service Dashboard)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/gethomepage/homepage:latest` |
| Port | 3000/TCP |
| Helm chart | homepage (deployed via HelmRelease in `webapps`) |
| Status | ✅ Running |

### Landing Page
| Property | Value |
|----------|-------|
| Image | `node:22-alpine` |
| Port | 80/TCP (custom app) |
| Status | ✅ Running |

### Silex (Design Tool)
| Property | Value |
|----------|-------|
| Image | `silexlabs/silex:3.6.6` |
| Port | 8080/TCP |
| Config PVC (root) | 4 GiB local-path |
| Hosting PVC | 4 GiB local-path (user projects) |
| URL | `silex.becklab.cloud` (admin SSO) |
| Status | ✅ Running |

### OpenClaw
| Property | Value |
|----------|-------|
| URL | `nova.becklab.cloud` (admin SSO) |
| TLS | `nova-tls` (expires 2026-10-16) |
| Status | ✅ Running |

---

## Media Namespace (`media`)

> All services in this namespace are internal-only (no IngressRoutes). Access via LAN or kubectl port-forward.
> **Note:** SpotWeb, qBittorrent+Gluetun, and SABnzbd were moved into this namespace from their previous locations.

### Jellyfin (Media Server)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/jellyfin:latest` |
| Port | 8096/TCP |
| Config PVC | 20 GiB local-path |
| Libraries | media-anime (45T), media-movies (45T), media-shows (45T) via LVM PV mounts |
| Status | ✅ Running |

### Sonarr (TV Show Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/sonarr:latest` |
| Port | 8989/TCP |
| Config PVC | 10 GiB local-path |
| Status | ✅ Running |

### Radarr (Movie Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/radarr:latest` |
| Port | 7878/TCP |
| Config PVC | 10 GiB local-path |
| Status | ✅ Running |

### Prowlarr (Indexer Aggregator)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/prowlarr:latest` |
| Port | 9696/TCP |
| Config PVC | 5 GiB local-path |
| Status | ✅ Running |

### Bazarr (Subtitle Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/bazarr:latest` |
| Port | 6767/TCP |
| Config PVC | 5 GiB local-path |
| Status | ✅ Running |

### SABnzbd (NZB Downloader)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/sabnzbd:latest` |
| Port | 8080/TCP |
| Config PVC | 5 GiB local-path |
| Download dir | media-downloads-lvm (5 TiB) |
| Status | ✅ Running |

### nzbget (Alternative NZB Downloader)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/nzbget:latest` |
| Port | 6789/TCP |
| Config PVC | 5 GiB local-path |
| Status | ✅ Running |

### qBittorrent + Gluetun VPN
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/qbittorrent:latest` (with Gluetun sidecar) |
| Port | 8080/TCP (Web UI) |
| Config PVC | 5 GiB local-path |
| VPN | Gluetun for anonymized torrenting |
| Status | ✅ Running — **MOVED** from `torrent` namespace |

### Tdarr (Media Transcoding)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/haveagitgat/tdarr:latest` |
| Port | 8265/TCP |
| Config PVC | 5 GiB local-path |
| Status | ✅ Running |

### Jellyseerr (Request Management)
| Property | Value |
|----------|-------|
| Image | `seerr/seerr:latest` |
| Port | 5055/TCP |
| Config PVC | 10 GiB local-path |
| Status | ✅ Running |

### Homebox (Inventory Management)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/sysadminsmedia/homebox:latest` |
| Port | 7745/TCP |
| Config PVC | 10 GiB local-path |
| Status | ✅ Running |

### SpotWeb + MariaDB (NZB Search)
| Property | Value |
|----------|-------|
| Image | `jgeusebroek/spotweb:latest` |
| Database | MariaDB via StatefulSet (5 GiB PVC) |
| Config PVC | 1 GiB local-path |
| Status | ✅ Running — **MOVED** from `spotweb` namespace |

---

## Monitoring Namespace (`monitoring`)

### kube-prometheus-stack (v65.5.0)
Deploys the full Prometheus monitoring stack:

| Component | Type | Details |
|-----------|------|---------|
| kps-operator | Deployment | Prometheus Operator v0.77.2 |
| prometheus-kps-prometheus-0 | StatefulSet | 50 GiB PVC, TSDB storage |
| alertmanager-kps-alertmanager-0 | StatefulSet | 5 GiB PVC |
| kube-prometheus-stack-grafana | Deployment | 10 GiB PVC, dashboards + datasources |
| kube-state-metrics | Deployment | v2.13.0, cluster state metrics |
| prometheus-node-exporter | DaemonSet | Per-node hardware/OS metrics |

### Access
- **Grafana:** `grafana.becklab.cloud` (admin SSO)
- **Hubble UI:** `hubble.becklab.cloud` (admin SSO, network visibility)
- **Prometheus + Alertmanager:** No IngressRoutes — internal only (TLS certs exist: prometheus-tls, alertmanager-tls)

---

## Security Namespace (`security`)

### Wazuh Stack
| Component | Type | Details |
|-----------|------|---------|
| wazuh-manager-master-0 | StatefulSet | SIEM manager master node (0 restarts — **FIXED**, was 641+) |
| wazuh-manager-worker-0,1 | StatefulSet | Manager worker nodes (0 restarts — **FIXED**) |
| wazuh-indexer-0 | StatefulSet | OpenSearch indexer for alert storage |
| wazuh-dashboard | Deployment | Web UI — no IngressRoute yet (planned: `wazuh.becklab.cloud`) |
| wazuh-agent | DaemonSet | Host monitoring agents on both nodes |

### Trivy Operator
| Property | Value |
|----------|-------|
| Image | `mirror.gcr.io/aquasec/trivy-operator:0.30.0` |
| Purpose | Continuous vulnerability scanning of container images and cluster configs |
| Scan mode | On pod creation + daily scheduled rescans |
| Output | Kubernetes SecurityReports CRDs, ComplianceReports CRDs, SBOMs |
| Status | ✅ Running — **MOVED** from `trivy-system` namespace |

### Suricata (IDS)
| Property | Value |
|----------|-------|
| Image | `jasonish/suricata:8.0.6` |
| Mode | IDS (detect-only) |
| Ruleset | Emerging Threats Open (ETOpen) |
| Deployment | DaemonSet (2/2 pods, one per node) |
| Output | EVE JSON logs → Wazuh manager via syslog port 514/TCP |
| Status | ✅ Running — **NEW** since July 12 |

---

## Crowdsec Namespace (`crowdsec`)

> New deployment 2026-07-20. WAF + behavioral analysis with Traefik bouncer integration.

### Crowdsec LAPI
| Property | Value |
|----------|-------|
| Image | `crowdsecurity/local-api:latest` (via Helm chart v0.20.0) |
| Port | 8080/TCP (cluster-internal) |
| Replicas | 1 |
| Storage | PersistentVolume for config + data |
| Mode | Local-only (no cloud enrollment) |
| Auto-registration | Enabled for agents + bouncer (token-based, cluster IP ranges) |
| Status | ✅ Running |

### Crowdsec Agents
| Property | Value |
|----------|-------|
| Image | `crowdsecurity/falcon:latest` (agent v1.7.0) |
| Deployment | DaemonSet (1 per node, auto-scheduled) |
| Acquisition | Traefik logs (`namespace: traefik`, `program: traefik`) |
| Output | Parsed logs → LAPI for scenario analysis |
| Status | ✅ 2/2 Running |

### Traefik Bouncer Plugin
| Property | Value |
|----------|-------|
| Plugin | `maxlerebourg/crowdsec-bouncer-traefik-plugin` v1.4.5 |
| Mode | Stream (real-time decision streaming via HTTP long-poll) |
| LAPI target | `crowdsec-service.crowdsec.svc.cluster.local:8080` |
| Key | Mounted from `crowdsec-bouncer-key` secret at `/etc/traefik/crowdsec/` |
| Scope | Global on `web` + `websecure` entrypoints |
| Trusted IPs | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` |
| Status | ✅ Streaming, registered with LAPI |

---

## Gaming Namespace (`gaming`)

### Crafty Controller (Minecraft Server Management)
| Property | Value |
|----------|-------|
| Image | `registry.gitlab.com/crafty-controller/crafty-4:latest` |
| Ports | 8443/TCP (HTTPS), 8123/TCP (Web UI) |
| Config PVC | 1 GiB local-path |
| World PVC | 20 GiB local-path |
| Logs PVC | 5 GiB local-path |
| Import PVC | 20 GiB local-path |
| Backup PVC | 20 GiB local-path |
| Database | PostgreSQL via StatefulSet (5 GiB PVC) |
| Minecraft access | NodePort :31337 → pod port 25565/TCP |
| Status | ✅ Running |

---

## LLM Namespace (`llm`)

### llama.cpp ExternalName Service
| Property | Value |
|----------|-------|
| Type | ExternalName → `172.16.0.7:8088` |
| Purpose | Points to external Ollama/llama.cpp instance on the LAN |

### rho
- Custom service, details in `flux/infrastructure/llm/rho.yaml`

---

## OpenNebula Namespace (`opennebula`)

### Sunstone Proxy
| Property | Value |
|----------|-------|
| Service | opennebula-sunstone:2616 |
| URL | `one.becklab.cloud` (admin SSO) |
| Purpose | In-cluster proxy to OpenNebula management UI on the hypervisor |

---

## Velero Namespace (`velero`)

See [Storage & Backups Deep Dive](storage-backups.md) for full details.

- **Velero** v1.15.0 — 5 backup schedules
- **MinIO** — S3-compatible storage backend, 200 GiB LVM PV
- **node-agent** DaemonSet — filesystem backup on both nodes

---

## Toolbox Namespace (`toolbox`)

### Build Containers
| Property | Value |
|----------|-------|
| Purpose | Kaniko build pods for in-cluster image builds |
| Current work | `build-user-invite` (Completed), `build-gridspace` (Completed) |
| Pattern | Ephemeral pods, created as needed |

---

## Swiparr — Deployed Service (2026-07-23)

> "Tinder for movies" — collaborative watch discovery. In `media` namespace alongside Jellyfin stack.

### Swiparr
| Property | Value |
|----------|-------|
| Source | [m3sserstudi0s/swiparr](https://github.com/m3sserstudi0s/swiparr) |
| Image | `ghcr.io/m3sserstudi0s/swiparr:latest` |
| Port | `4321/TCP` |
| Database | SQLite (`/app/data/swiparr.db`) or Turso (remote) |
| Data volume | `2Gi` local-path PVC |
| Provider modes | Jellyfin (full), Emby (experimental), Plex (experimental), TMDB (standalone) |
| SSO | Media tier SSO via `sso-media-chain` |
| IngressRoute | `swiparr.becklab.cloud` (media SSO, `identity-sso-media-chain`) |
| TLS | `swiparr-tls` (letsencrypt-prod, auto-issued) |
| Namespace | `media` |
| Status | ✅ Running |

#### Overview

Swiparr turns "what should we watch?" into a collaborative swipe-based discovery experience. Users create or join sessions, swipe right/left on content from their media library (or TMDB), and get matched recommendations based on group preferences. Supports "any two people" or "unanimous" match strategies, max likes/nopes/matches limits, and guest lending (guests swipe using host's credentials).

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Swiparr (Node.js + Next.js)                           │
│                                                         │
│  PROVIDER_LOCK=true  →  Admin-configured single source  │
│  PROVIDER_LOCK=false →  BYOP — each user connects own   │
│                                                         │
│  Providers: Jellyfin ★  |  Emby △  |  Plex △  |  TMDB  │
│                                                         │
│  Auth: iron-session + encrypted guest tokens            │
│  DB: SQLite (file) or Turso (remote)                    │
└──────────────────────────────┬──────────────────────────┘
                               │
                    Jellyfin/Emby/Plex/TMDB API
```

#### Environment Variables (Key)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PROVIDER` | Yes | `jellyfin` | `jellyfin`, `tmdb`, `plex`, or `emby` |
| `PROVIDER_LOCK` | No | `true` | `false` = BYOP mode |
| `JELLYFIN_URL` | Yes* | — | Internal URL of media server |
| `JELLYFIN_PUBLIC_URL` | No | — | Public URL (for client-side access) |
| `TMDB_ACCESS_TOKEN` | Yes* | — | TMDB read-only API token |
| `AUTH_SECRET` | No | Auto-gen | Min 32 chars; auto-generated on boot if missing |
| `DATABASE_URL` | No | `file:/app/data/swiparr.db` | SQLite path or Turso URL |
| `USE_SECURE_COOKIES` | No | `false` | Set `true` for HTTPS |
| `URL_BASE_PATH` | No | — | Subpath deployment (build-time) |
| `ADMIN_USERNAME` | No | — | Global admin username |
| `ALLOW_PRIVATE_PROVIDER_URLS` | No | `false` | Block LAN URLs for BYOP |
| `USE_STATIC_FILTERS` | No | `false` | Skip dynamic filter fetch (large libs) |

> *Required when that provider is selected.

#### Deployment Plan

Deployed via K3s manifest in `flux/infrastructure/media/swiparr.yaml`. The K3s local-path provisioner was missing from the cluster (manifest existed but deployment was never created) — deployed manually on 2026-07-23.

#### Status
- Provisioner: `local-path-provisioner` (deployed from K3s bundled manifest)
- PVC: `swiparr-data` (2Gi, local-path, bound)
- Pod: `swiparr` (1/1 Running, Next.js 16.1.6)
- IngressRoute: `swiparr.becklab.cloud` → `swiparr:4321` via `sso-media-chain`
- TLS: `swiparr-tls` issued by letsencrypt-prod (HTTP-01 challenge)
- Auth: Built-in auth + Jellyfin provider. Media tier SSO (`sso-media-chain`) via Keycloak `/media` group.
- Provider: Jellyfin at `http://jellyfin.media.svc.cluster.local:8096`

#### SSO Integration
- Uses `identity-sso-media-chain` middleware (oauth2-proxy + Keycloak `/media` group)
- BYOP mode or guest lending works without SSO
- Match strategy: `"any two people"` recommended for group size

#### Considerations
- **Database**: SQLite by default — fine for single-instance, but consider Turso migration for HA
- **PWA**: Ships as PWA — users can install as web app
- **Guest Lending**: Host credentials encrypted at rest via `AUTH_SECRET` while enabled
- **Experimental providers**: Emby and Plex support still improving — Jellyfin is the primary target
- **TMDB mode**: No media server needed — works as standalone discovery tool
- **Port**: Uses non-standard `4321` — not a well-known port
- **local-path provisioner**: Was missing from cluster — deployed from K3s manifest `/var/lib/rancher/k3s/server/manifests/local-storage.yaml` on 2026-07-23
- **AUTH_SECRET**: Auto-generated on first boot and stored in SQLite database (not env var)

---

*End of services catalog.*
