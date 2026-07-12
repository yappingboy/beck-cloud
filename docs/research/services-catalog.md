# Services Catalog — Detailed Reference

**Last audited:** 2026-07-12  
**Scope:** Every running service with operational details, ports, config locations, and access patterns

---

## Affine Namespace (`affine`)

> New deployment ~2026-07-11. Collaborative wiki/knowledge base.

### Affine Server
| Property | Value |
|----------|-------|
| Image | (see Flux manifest) |
| Port | 3010/TCP |
| URL | `affine.becklab.cloud` (admin SSO) |
| Status | ✅ Running, IngressRoute active |

### Affine PostgreSQL
| Property | Value |
|----------|-------|
| Type | StatefulSet |
| Status | ⚠️ Restarting (6 restarts in 36h) |

### Affine Redis
| Property | Value |
|----------|-------|
| Type | Deployment/StatefulSet |
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
| Bind DN | `uid=admin,ou=people,dc=becklab,dc=cloud` |
| Users DN | `ou=people,dc=becklab,dc=cloud` |
| Username attribute | `uid` |
| Edit mode | READ_ONLY (users managed in LLDAP) |
| Status | ⚠️ Running but showing readiness issues (12 restarts in 3d) |

### LLDAP (User Directory)
| Property | Value |
|----------|-------|
| Image | `lldap/lldap:stable` |
| LDAP port | 389/TCP (cluster-internal) |
| Web UI port | 17170/TCP |
| Storage | 5 GiB local-path PVC |
| Groups | `/admins`, `/media` |

### oauth2-proxy (Admin Tier)
| Property | Value |
|----------|-------|
| Image | `quay.io/oauth2-proxy/oauth2-proxy:v7.6.0` |
| Helm chart | oauth2-proxy v7.6.0 |
| Provider | Keycloak OIDC (`homelab` realm) |
| Session store | Redis (local STS, 1 GiB PVC) |
| Auth endpoint | `/oauth2/auth` (ForwardAuth target for Traefik) |
| Group requirement | `/admins` |
| Status | ❌ CrashLoopBackOff — SSO broken |

### oauth2-proxy-media (Media Tier)
| Property | Value |
|----------|-------|
| Image | `quay.io/oauth2-proxy/oauth2-proxy:v7.6.0` |
| Helm chart | oauth2-proxy v7.6.0 |
| Provider | Keycloak OIDC (`homelab` realm) |
| Session store | Redis (shared with admin tier) |
| Group requirement | `/media` |
| Status | ❌ CrashLoopBackOff — SSO broken |

### Supporting Services
- **logout-page** — nginx:alpine serving logout landing page
- **sso-redirect** — nginx:1.27-alpine, catches 401 errors and redirects to Keycloak login
- **user-invite** — Custom Python app (`ghcr.io/yappingboy/becklab-user-invite:v1`) for user provisioning (one old pod ErrImagePull)

---

## Media Namespace (`media`)

> All services in this namespace are internal-only (no IngressRoutes). Access via LAN or kubectl port-forward.

### Jellyfin (Media Server)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/jellyfin:latest` |
| Port | 8096/TCP |
| Config PVC | 20 GiB local-path |
| Libraries | media-anime (45T), media-movies (45T), media-shows (45T) via LVM PV mounts |
| Status | ⚠️ Unknown status |

### Sonarr (TV Show Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/sonarr:latest` |
| Port | 8989/TCP |
| Config PVC | 10 GiB local-path |
| Connected to | Prowlarr (indexer), SABnzbd/nzbget/qBittorrent (downloaders), Jellyfin (notify) |

### Radarr (Movie Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/radarr:latest` |
| Port | 7878/TCP |
| Config PVC | 10 GiB local-path |
| Connected to | Prowlarr (indexer), downloaders, Jellyfin |

### Prowlarr (Indexer Aggregator)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/prowlarr:latest` |
| Port | 9696/TCP |
| Config PVC | 5 GiB local-path |
| Indexers | NZB and torrent indexers configured here, shared with Sonarr/Radarr/Readarr |

### Bazarr (Subtitle Management)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/bazarr:latest` |
| Port | 6767/TCP |
| Config PVC | 5 GiB local-path |
| Connected to | Sonarr, Radarr for library sync |

### SABnzbd (NZB Downloader)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/sabnzbd:latest` |
| Port | 8080/TCP |
| Config PVC | 5 GiB local-path |
| Download dir | media-downloads-lvm (5 TiB) |

### nzbget (Alternative NZB Downloader)
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/nzbget:latest` |
| Port | 6789/TCP |
| Config PVC | 5 GiB local-path |

### Tdarr (Media Transcoding)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/haveagitgat/tdarr:latest` |
| Port | 8265/TCP |
| Config PVC | 5 GiB local-path |
| Purpose | Batch transcode media files to optimal formats |
| Status | ⚠️ Unknown status |

### Jellyseerr (Request Management)
| Property | Value |
|----------|-------|
| Image | `seerr/seerr:latest` |
| Port | 5055/TCP |
| Config PVC | 10 GiB local-path |
| Purpose | Media request/approval system, integrates with Sonarr/Radarr |

### Homebox (Inventory Management)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/sysadminsmedia/homebox:latest` |
| Port | 7745/TCP |
| Config PVC | 10 GiB local-path |
| Purpose | Physical inventory tracking (tools, equipment, etc.) |

---

## Torrent Namespace (`torrent`)

### qBittorrent + Gluetun VPN
| Property | Value |
|----------|-------|
| Image | `lscr.io/linuxserver/qbittorrent:latest` (with Gluetun sidecar) |
| Port | 8080/TCP (Web UI) |
| Config PVC | 5 GiB local-path |
| Download dir | torrent-downloads-lvm (5 TiB) |
| VPN | Gluetun for anonymized torrenting |
| Status | ⚠️ Unknown status, 1/2 containers ready |

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
| wazuh-manager-master-0 | StatefulSet | SIEM manager master node (high restart count — 641+) |
| wazuh-manager-worker-0,1 | StatefulSet | Manager worker nodes (also high restart counts) |
| wazuh-indexer-0 | StatefulSet | OpenSearch indexer for alert storage |
| wazuh-dashboard | Deployment | Web UI — no IngressRoute yet (planned: `wazuh.becklab.cloud`) |
| wazuh-agent | DaemonSet | Host monitoring agents on both nodes |

> **Note:** Wazuh is deployed but not fully stable. Manager pods have very high restart counts suggesting resource or configuration issues. No external IngressRoute yet — planned for admin SSO tier. See [Security Suite Plan](security-suite.md).

### Trivy Operator
| Property | Value |
|----------|-------|
| Namespace | `trivy-system` (separate from security) |
| Purpose | Continuous vulnerability scanning of container images and cluster configs |
| Scan mode | On pod creation + daily scheduled rescans |
| Output | Kubernetes SecurityReports CRDs, ComplianceReports CRDs, SBOMs |
| Status | ✅ Operator running, scan jobs active |

---

## Bitwarden Namespace (`bitwarden`)

### Vaultwarden BSM (Bitwarden Secrets Manager)
| Property | Value |
|----------|-------|
| Image | `vaultwarden/server:latest` |
| Port | 80/TCP (internal) |
| Config PVC | 10 GiB local-path |
| URL | `bw.becklab.cloud` (no SSO — Vaultwarden's own auth) |

---

## CMS Namespace (`cms`)

### Directus 11
| Property | Value |
|----------|-------|
| Image | `directus/directus:11` |
| Port | 8055/TCP |
| Config PVC | 2 GiB local-path |
| URL | `cms.becklab.cloud` (admin SSO) |

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

---

## Homepage Namespace (`homepage`)

### Homepage (Service Dashboard)
| Property | Value |
|----------|-------|
| Image | `ghcr.io/gethomepage/homepage:latest` |
| Port | 3000/TCP |
| Helm chart | homepage v1.2.3 |
| Status | No IngressRoute — internal only (TLS cert exists) |

---

## Landing Namespace (`landing`)

### Custom Landing Page
| Property | Value |
|----------|-------|
| Image | `node:22-alpine` |
| Port | 80/TCP (inferred, custom app) |
| Source | `flux/infrastructure/landing-page/server.js` |

### Silex (Design Tool)
| Property | Value |
|----------|-------|
| Image | `silexlabs/silex:3.6.6` |
| Port | 8080/TCP |
| Config PVC | 4 GiB local-path |
| Hosting PVC | 4 GiB local-path (user projects) |
| URL | `silex.becklab.cloud` (admin SSO) |

---

## Email Namespace (`email`)

### Postfix Relay
| Property | Value |
|----------|-------|
| Image | `mwader/postfix-relay:latest` |
| Backend | Mailgun API key (encrypted secret) |
| Purpose | Outbound email relay for cluster services (alerts, notifications) |
| TLS cert | mail-tls certificate exists |

---

## SpotWeb Namespace (`spotweb`)

### SpotWeb + MariaDB
| Property | Value |
|----------|-------|
| Image | `jgeusebroek/spotweb:latest` |
| Database | MariaDB via StatefulSet (5 GiB PVC) |
| Config PVC | 1 GiB local-path |
| Purpose | Newznab search frontend for NZB indexing |
| Status | ⚠️ Pod Running but not Ready, high restart count (25) |

---

## Toolbox Namespace (`toolbox`)

### Build Containers
| Property | Value |
|----------|-------|
| Purpose | Kaniko build pods for in-cluster image builds |
| Current work | `build-user-invite` — building user-invite app images to GHCR |
| Pattern | Ephemeral pods, created as needed |

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

*End of services catalog.*
