# Beck Cloud System Topology
**Last Updated:** 2026-06-22  
**Kubernetes Version:** v1.32.0 | **Node Count:** 2 (dual-NIC)  
**Cluster:** K3s @ 172.16.0.7 | **Flux:** 2.4 (yappingboy/beck-cloud)  
**CI/CD:** Flux CD + Helm | **Ingress:** Traefik 36.3.0 (30080/30443)  
**Storage:** md0 RAID6 (11/11 disks) 50TB on vg_tank/lv_tank

---

## Table of Contents
1. [Namespace Inventory](#namespace-inventory)
2. [Port Exposure Matrix](#port-exposure-matrix)
3. [Service-to-Pod Mappings](#service-to-pod-mappings)
4. [Persistent Volume Claim (PVC) Inventory](#pvc-inventory)
5. [Image Registry Sources](#image-registry-sources)
6. [Network Topology](#network-topology)
7. [Application Architecture by Namespace](#application-architecture-by-namespace)
8. [Issues & TODOs](#issues--todos)

---

## Namespace Inventory

| NAMESPACE       | PURPOSE                                    | WORKLOADS                          | AGE      |
|-----------------|--------------------------------------------|------------------------------------|----------|
| `kube-system`   | K8s system components                      | Cilium, CoreDNS, Metrics, Hubble   | 11d      |
| `cert-manager`  | TLS certificate management                  | cert-manager v1.16.5               | 11d      |
| `cilium-secrets`| Cilium secrets injector                    | Cilium CNI                         | 11d      |
| `cms`           | Content Management System                   | Directus v11                       | 11d      |
| `default`       | Default namespace (misc)                    | kubernetes (apiserver)             | 11d      |
| `flux-system`   | Flux CD controllers                        | helm, kustomize, notification ctrl | 11d      |
| `gaming`        | Crafty Controller + Minecraft server        | Crafty, crafty-minecraft NodePort  | 14h      |
| `homepage`      | Internal authenticated dashboard            | Homepage v1.2.3                    | 11d      |
| `identity`      | SSO / OAuth2 / LDAP                        | Keycloak, LLDAP, Redis, OAuth2-Proxy | 11d    |
| `kube-node-lease`| K3s node leases                            | (system)                           | 11d      |
| `kube-public`   | Public data for all namespaces             | (system)                           | 11d      |
| `landing`       | Public landing page                        | Node app, Silex, FTP               | 11d      |
| `llm`           | Local LLM inference                        | llamactl (ExternalName → 172.16.0.7:8088) | 11d |
| `media`         | Media server stack                         | Jellyfin + Radarr/Sonarr/Bazarr etc | 4d10h  |
| `monitoring`    | Prometheus + Grafana monitoring stack      | Prometheus 65.5.0, Grafana         | 11d      |
| `nvidia`        | NVIDIA GPU device plugin                   | nvidia-device-plugin               | 11d      |
| `opennebula`    | OpenNebula cloud VM management              | sunstone (2616/TCP)                | 11d      |
| `security`      | Security policies / network policies       | (empty)                            | -        |
| `spotweb`       | SpotWeb torrent tracker (PHP+MariaDB)       | spotweb v1, MariaDB 11             | 5d10h    |
| `torrent`       | Torrent clients                            | qBittorrent + Gluetun              | 4d10h    |
| `traefik`       | Traefik ingress controller                 | Traefik v36.3.0                    | 11d      |
| `velero`        | Kubernetes backup/restore                   | Velero v8.0.0 + MinIO              | 4d5h     |

---

## Port Exposure Matrix

### Ingress Routes (Traefik: 80:30080, 443:30443)

| HOST                        | NAMESPACE   | TARGET SERVICE              | INTERNAL PORT |
|-------------------------    |-------------|-----------------------------|---------------|
| `becklab.cloud`             | landing     | landing-page                | 80            |
| `crafty.becklab.cloud`      | gaming      | crafty                      | 8443 (https)  |
| `home.becklab.cloud`        | homepage    | homepage                    | 3000          |
| `keycloak.becklab.cloud`    | identity    | keycloak                    | 8080          |
| `lldap.becklab.cloud`       | identity    | lldap                       | 389, 17170    |
| `oauth2.becklab.cloud`      | identity    | oauth2-proxy                | 80            |
| `oauth2-media.becklab.cloud`| identity    | oauth2-proxy-media          | 80            |
| `logout.becklab.cloud`      | identity    | logout-page                 | 80            |
| `jellyfin.becklab.cloud`    | media       | jellyfin                    | 8096          |
| `requests.becklab.cloud`    | media       | jellyseerr                  | 5055          |
| `bazarr.becklab.cloud`      | media       | bazarr                      | 6767          |
| `homebox.becklab.cloud`     | media       | homebox                     | 7745          |
| `nzbget.becklab.cloud`      | media       | nzbget                      | 6789          |
| `radarr.becklab.cloud`      | media       | radarr                      | 7878          |
| `sonarr.becklab.cloud`      | media       | sonarr                      | 8989          |
| `tdarr.becklab.cloud`       | media       | tdarr                       | 8265          |
| `prowlarr.becklab.cloud`    | media       | prowlarr                    | 9696          |
| `qbit.becklab.cloud`        | torrent     | qbit-gluetun                | 80            |
| `spotweb.becklab.cloud`     | spotweb     | spotweb                     | 80            |
| `alertmanager.becklab.cloud`|monitoring   | alertmanager                | 9093          |
| `prometheus.becklab.cloud`  |monitoring   | kps-prometheus              | 9090          |
| `opennebula:2616`           | opennebula  | opennebula-sunstone         | 2616          |

### Other Exposed Services (NodePort/ClusterIP)

| SERVICE                    | PORTS          | NAMESPACE    | TYPE        |
|----------------------------|----------------|--------------|------------ |
| `crafty-minecraft`          | 25565:30065    | gaming       | NodePort    |
| `traefik`                   | 30080,30443    | traefik      | NodePort    |
| `llamactl`                  | 172.16.0.7:8088| llm          | ExternalName|

---

## Service-to-Pod Mappings

### kube-system
- **cilium** → Cilium agent pods (CNI plugin)
- **coredns** → CoreDNS pods (cluster DNS resolution)
- **metrics-server** → Metrics Server pods (resource metrics for HPA)
- **local-path-provisioner** → Local Path Provisioner pods (dynamic PVC provisioning for local-path storageclass)
- **traefik** → Traefik proxy pods (ingress controller)

### cms
- **directus** → Directus pods (headless CMS, API-first)
- **directus-db** → PostgreSQL 16 pods (CMS database)

### default
- **kubernetes** → API server (cluster control plane)

### flux-system
- **helm-controller** → Flux Helm controller (manages HelmReleases)
- **kustomize-controller** → Flux Kustomization controller (applies Kustomizations)
- **notification-controller** → Flux notification controller (alerts)
- **source-controller** → Flux source controller (git/helm repo sync)

### gaming
- **crafty** → Crafty Controller pods (server management dashboard)
  - Dashboard: `crafty.becklab.cloud` via Traefik (https://10.42.1.86:8443)
  - Minecraft server: exposed on NodePort 30065 → crafty-minecraft service → pod port 25565

### homepage
- **homepage** → Homepage pods (authenticated internal dashboard)
  - URL: `home.becklab.cloud` (SSO protected via oauth2-proxy)

### identity
- **keycloak** → Keycloak pods (OAuth2/OIDC SSO provider)
  - URL: `keycloak.becklab.cloud`
- **lldap** → LLDAP pods (simple LDAP provider)
  - URL: `lldap.becklab.cloud` (port 389 + 17170)
- **redis** → Redis pods (Keycloak session store)
- **oauth2-proxy** → OAuth2 Proxy pods (admin dashboard auth gateway)
  - URL: `oauth2.becklab.cloud`
- **oauth2-proxy-media** → OAuth2 Proxy pods (media dashboard auth gateway)
  - URL: `oauth2-media.becklab.cloud`
- **logout-page** → Logout page pod (session termination page)
  - URL: `logout.becklab.cloud`

### landing
- **landing-page** → Node app pods (public site)
  - URL: `becklab.cloud`
- **silex** → Silex pods (public wiki/documentation)
- **pure-ftpd** → Pure-FTPD pod (FTP server)
  - Port: 21/TCP
  - User: `ftpuser`, Pass: `BeckL@b2026!` (stored in `pure-ftpd-passwd` secret)

### llm
- **llamactl** → ExternalName service (points to 172.16.0.7:8088, llama-server on host)
  - Image: Qwen3.6-27B-Q4_K_M via llama-server (port 8000, --parallel 4, --ctx-size 256000)

### media
- **jellyfin** → Jellyfin pods (media streaming)
  - URL: `jellyfin.becklab.cloud` (port 8096)
  - Libraries: /media/anime, /movies, /shows, /downloads (all mounted from PVCs)
- **jellyseerr** → Jellyseerr pods (media request management)
  - URL: `requests.becklab.cloud` (port 5055)
- **bazarr** → Bazarr pods (subtitle management)
  - URL: `bazarr.becklab.cloud` (port 6767)
- **homebox** → Homebox pods (digital inventory)
  - URL: `homebox.becklab.cloud` (port 7745)
- **nzbget** → NZBGet pods (NZB download client)
  - URL: `nzbget.becklab.cloud` (port 6789)
- **radarr** → Radarr pods (movie management)
  - URL: `radarr.becklab.cloud` (port 7878)
- **sonarr** → Sonarr pods (TV show management)
  - URL: `sonarr.becklab.cloud` (port 8989)
- **tdarr** → tdarr pods (video transcoding)
  - URL: `tdarr.becklab.cloud` (port 8265)
- **prowlarr** → Prowlarr pods (indexer management)
  - URL: `prowlarr.becklab.cloud` (port 9696)
- **nzbhydra2** → NZBHydra2 pods (NZB indexer aggregation)

### monitoring
- **kps-prometheus** → KPS Prometheus pods (Prometheus 65.5.0)
  - URL: `prometheus.becklab.cloud` (port 9090)
- **alertmanager** → Alertmanager pods (alerting)
  - URL: `alertmanager.becklab.cloud` (port 9093)
- **node-exporter** → Node Exporter pods (host metrics)
- **prometheus-adapter** → Prometheus adapter pods (custom metrics API)
- **grafana** → Grafana pod (monitoring dashboards)

### spotweb
- **spotweb** → SpotWeb pods (NZB tracker web UI, PHP 8.3+FPM)
  - URL: `spotweb.becklab.cloud` (port 80)
- **spotweb-db** → MariaDB 11.4.4 pods (SpotWeb database)
- **spotweb-cache** → Redis 8.0.4 pods (SpotWeb cache)

### torrent
- **qbit-gluetun** → qBittorrent + Gluetun pods (torrent client + VPN tunnel)
  - URL: `qbit.becklab.cloud` (port 80)
  - Shared PVC: torrent-downloads-lvm (5Ti)

### traefik
- **traefik** → Traefik ingress controller pods (v36.3.0)
  - NodePort 30080 (HTTP), 30443 (HTTPS)

### velero
- **minio** → MinIO pods (S3-compatible object storage)
- **velero** → Velero pods (Kubernetes backup/restore v8.0.0)
- **velero-plugin-for-aws** → Velero AWS plugin pods (plugin for minio S3)

---

## PVC Inventory

### High-Capacity Shared PVCs (RWX on md0 RAID6)

| PVC NAME                 | NAMESPACE | CAPACITY | MOUNT PATH                       | APPS                                    |
|--------------------------|-----------|----------|-------------------------------   |-----------------------------------------|
| `media-anime-lvm`        | media     | 45Ti     | /media/anime                     | Jellyfin (anime library)                |
| `media-movies-lvm`       | media     | 45Ti     | /media/movies                    | Jellyfin (movies library)               |
| `media-shows-lvm`        | media     | 45Ti     | /media/shows                     | Jellyfin (TV shows library)             |
| `media-downloads-lvm`    | media     | 5Ti      | /media/downloads                 | NZBGet downloads                        |
| `torrent-downloads-lvm`  | torrent   | 5Ti      | /torrent/downloads               | qBittorrent downloads                   |

### Database PVCs (RWO)

| PVC NAME                 | NAMESPACE | CAPACITY | MOUNT PATH                       | APPS                                    |
|--------------------------|-----------|----------|-------------------------------   |-----------------------------------------|
| `directus-db-data`       | cms       | 1Gi      | /var/lib/postgresql/data         | Directus database                       |
| `spotweb-db-data`        | spotweb   | 1Gi      | /var/lib/mysql                   | SpotWeb database                        |
| `spotweb-cache-data`     | spotweb   | 1Gi      | /data                            | SpotWeb cache                           |
| `spotweb-config-data`    | spotweb   | 1Gi      | /etc/spotweb                     | SpotWeb config                          |
| `velero-logs-data`       | velero    | 1Gi      | /logs                            | Velero logs                             |

### Other PVCs (RWO)

| PVC NAME                 | NAMESPACE | CAPACITY | MOUNT PATH                       | APPS                                    |
|--------------------------|-----------|----------|-------------------------------   |-----------------------------------------|
| `crafty-config`          | gaming    | 1Gi      | /home/crafty/crafty/config       | Crafty controller config                |
| `crafty-world`           | gaming    | 20Gi     | /home/crafty/crafty/data         | Crafty worlds + server configs          |
| `homebox-data`           | media     | 10Gi     | /home/box                       | Homebox                                 |
| `tdarr-server-config`    | media     | 1Gi      | /app/config                      | tdarr configuration                     |
| `tdarr-server-logs`      | media     | 1Gi      | /logs                            | tdarr logs                              |
| `tdarr-server-plugins`   | media     | 1Gi      | /app/server/plugins              | tdarr plugins                           |
| `tdarr-server-db`        | media     | 1Gi      | /app/server/db                   | tdarr database                          |
| `tdarr-node-logs`        | media     | 1Gi      | /logs                            | tdarr node logs                         |
| `tdarr-node-plugins`     | media     | 1Gi      | /app/plugins                     | tdarr node plugins                      |
| `tdarr-node-db`          | media     | 1Gi      | /app/db                          | tdarr node database                     |

---

## Image Registry Sources

### Official Registries

| IMAGE                                           | REGISTRY                                      |
|--------------------------------------------------|-----------------------------------------------|
| `jellyfin/jellyfin:latest`                       | Docker Hub                                    |
| `linuxserver/jellyseerr:latest`                  | Docker Hub                                    |
| `linuxserver/bazarr:latest`                      | Docker Hub                                    |
| `ghcr.io/romansonik/homebox:v0.15.0`             | GitHub Container Registry                     |
| `ghcr.io/nzbgetcom/nzbget:25.1`                  | GitHub Container Registry                     |
| `ghcr.io/radarr/radarr:main`                     | GitHub Container Registry                     |
| `ghcr.io/sonarr/sonarr:main`                     | GitHub Container Registry                     |
| `ghcr.io/has-lbl/tdarr:v2.70.0`                  | GitHub Container Registry                     |
| `ghcr.io/prowlarr/prowlarr:develop`              | GitHub Container Registry                     |
| `linuxserver/nzbhydra2:latest`                   | Docker Hub                                    |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | GitHub Container Registry                     |
| `ghcr.io/dani-garcia/vaultwarden:latest`         | GitHub Container Registry                     |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | GitHub Container Registry                     |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | GitHub Container Registry                     |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | GitHub Container Registry                     |

### GitHub Container Registry (GHCR)

| IMAGE                                           | SOURCE                                          |
|--------------------------------------------------|--------------------------------------------------|
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |
| `ghcr.io/dani-garcia/vaultwarden:latest`         | dani-garcia/vaultwarden GitHub repo               |
| `ghcr.io/ghcr.io/ghcr.io/paperclip-ai/teich-studio:latest` | paperclip-ai/teich-studio GitHub repo  |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |

### Other Sources

| IMAGE                                           | SOURCE                                          |
|--------------------------------------------------|--------------------------------------------------|
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |
| `ghcr.io/paperclip-ai/teich-studio:latest`       | paperclip-ai/teich-studio GitHub repo             |

---

## Network Topology

### K3s Cluster Network

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            K3s Cluster                                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Management Network                          │  │
│  │                           (192.168.100.0/24)                       │  │
│  │                                                                   │  │
│  │   ┌───────────────────┐              ┌───────────────────┐        │  │
│  │   │  Control Plane    │              │  Worker Node      │        │  │
│  │   │  192.168.100.10   │◄────────────►│  192.168.100.11   │        │  │
│  │   │                   │  SSH + k3s   │                   │        │  │
│  │   │  Server API       │              │  Cilium agent     │        │  │
│  │   │  etcd             │              │  kubelet          │        │  │
│  │   │  scheduler        │              │  CRI              │        │  │
│  │   └───────────────────┘              └───────────────────┘        │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Service Network                          │  │  │
│  │  │                     (10.43.0.0/16)                            │  │  │
│  │  │                                                               │  │  │
│  │  │  ClusterIP services:                                          │  │  │
│  │  │  - crafty:8443 (gaming)                                       │  │  │
│  │  │  - crafty-minecraft:25565 (gaming)                            │  │  │
│  │  │  - All other namespace services                               │  │  │
│  │  │                                                               │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                     Pod Network                              │  │  │
│  │  │                     (10.42.0.0/16)                           │  │  │
│  │  │                                                               │  │  │
│  │  │  Cilium-enforced pod networking with:                         │  │  │
│  │  │  - Automatic pod IP assignment                                │  │  │
│  │  │  - Network policies                                           │  │  │
│  │  │  - Service mesh capabilities                                  │  │  │
│  │  │  - Hubble observability                                       │  │  │
│  │  │                                                               │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                           External Access                          │  │
│  │                                                                   │  │
│  │  ┌─────────────┐     ┌─────────────┐                              │  │
│  │  │  NodePort   │     │  Ingress    │                              │  │
│  │  │  30065      │     │  Routes     │                              │  │
│  │  │  (Minecraft)│     │  (HTTPS)    │                              │  │
│  │  └─────────────┘     └─────────────┘                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### External Service Access

| SERVICE           | ENDPOINT                | PROTOCOL    | PATH                              |
|-------------------|-------------------------|-------------|-----------------------------------|
| Minecraft         | 172.16.0.7:30065        | Minecraft   | crafty-minecraft → crafty:25565   |
| Crafty Dashboard  | crafty.becklab.cloud    | HTTPS/443   | Traefik → crafty:8443             |

### Pod-to-Service Communication Flow

```
┌─────────────────────┐        ┌─────────────────────┐
│  Crafty Controller   │        │  Minecraft Players   │
│                      │        │                      │
│  Dashboard UI        │        │  Minecraft client    │
│  (HTTPS)             │        │                      │
│                      │        │                      │
│  crafty.becklab.cloud│        │  172.16.0.7:30065    │
│  :443                │        │                      │
└────────┬────────────┘        └────────┬────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│  Traefik Ingress     │        │  K3s NodePort      │
│                      │        │  (30065)            │
│  HTTPS termination   │        │                      │
└────────┬────────────┘        └────────┬────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                       K3s Services                    │
│                                                       │
│  ┌─────────────────┐        ┌─────────────────┐      │
│  │  crafty:8443     │        │ crafty-minecraft │      │
│  │  (ClusterIP)     │        │  (NodePort)      │      │
│  └────────┬─────────┘        └────────┬─────────┘      │
│           │                           │                │
│           └─────────────┬─────────────┘                │
│                         ▼                              │
│  ┌───────────────────────────────────────────────┐    │
│  │             crafty Controller Pod               │    │
│  │                                                 │    │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  │    │
│  │  │ Dashboard  │  │ File Mgr   │  │ Minecraft │  │    │
│  │  │ (HTTPs)    │  │            │  │ server    │  │    │
│  │  │ :8443      │  │ :80        │  │ :25565    │  │    │
│  │  └────────────┘  └────────────┘  └──────────┘  │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Application Architecture by Namespace

### 🎮 gaming
```
┌──────────────────────────────────────────────┐
│ crafty Controller: crafty-controller/crafty-4│
│       ingress: crafty.becklab.cloud:443      │
│       nodeport: 172.16.0.7:30065 (Minecraft) │
│       PVCs: crafty-config, crafty-world      │
└──────────────────────────────────────────────┘
```

---

## Issues & TODOs

### ✅ Fixed (2026-06-22)

1. **Crafty Controller** — WAS wrong image + stale entrypoint (arcadiatechnology/crafty-4,
   `python3 main.py` missing from container)
   - **Root cause:** Old image from HuggingFace, not the official crafty-controller image.
     Container only serves HTTPS on 8443 (no port 80), entrypoint path `main.py` doesn't exist.
   - **Fix:** Switched to `registry.gitlab.com/crafty-controller/crafty-4:latest`. Probes+service
     updated for https:8443 with TLS. Removed stale `command`/`workingDir` (image has correct
     entrypoint). Removed duplicate `crafty-minecraft-nodeport` service (conflicted on nodePort
     30065) and invalid NodePort IngressRoute.
   - **Status:** Running 1/1. Dashboard at `crafty.becklab.cloud` (SSO-protected, https). Minecraft
     exposed at `172.16.0.7:30065` (NodePort). Two PVCs: config (1Gi) and world (20Gi).

2. **tdarr** — WAS no image tag + wrong timezone
   - **Root cause:** `ghcr.io/haveagitgat/tdarr` (no tag), TZ=America/Los_Angeles
   - **Fix:** Added `:latest` tag, changed TZ to America/New_York
   - **Status:** Running 1/1

### 🟡 High Priority

3. **Empty namespaces** (defined but no workloads)
   - `gaming` — crafty-controller dashboard + Minecraft server
   - `email` — resources commented out (postfix-relay, secret-mailu)
   - `security` — Falco/Wazuh disabled (documented in kustomization)
   - `nvidia` — device plugin commented out (GPU passthrough not used)
   - `llm` — only ExternalName service (actual LLM on host)
   - `opennebula` — service only (points to VM on hypervisor)
   - `cilium-secrets`, `default`, `kube-*` — system namespaces

4. **Namespace organization**
   - `media` + `torrent` — related but separate → consider consolidating
   - `identity` — well-organized (SSO stack)

5. **Local-Path StorageClass dependency**
   - Most PVCs use node-local storage → single point of failure
   - Databases (PostgreSQL, MariaDB, Redis) all on `local-path`
   - **Risk:** If worker node dies, data is lost

### 🟢 Medium Priority

6. **Siloed OAuth2 proxies**
   - Two separate oauth2-proxy instances (admin + media)
   - **Recommendation:** Document the split clearly

---

## Remediation Log


### Crafty Controller Fix
```bash
# crafty-controller.yaml changed:
#   image: arcadiatechnology/crafty-4:latest
#     → registry.gitlab.com/crafty-controller/crafty-4:latest
# entrypoint command removed (image has correct default)
# probes: httpGet port http → port https, scheme HTTPS
# service targetPort: 80 → 8443
# IngressRoute service scheme: http → https, port 80 → 8443
# crafty-ingress.yaml: removed duplicate crafty-minecraft-nodeport service
# Applied via Flux sync
```

### tdarr Fix
```bash
# tdarr.yaml changed:
#   FROM: ghcr.io/haveagitgat/tdarr (no tag)
#   TO:   ghcr.io/haveagitgat/tdarr:latest
# TZ: America/Los_Angeles → America/New_York
# Applied via Flux sync
```

---

## Architecture Notes

### Namespace Purpose Map
| Namespace   | Purpose                        | Workloads                            |
|-------------|--------------------------------|--------------------------------------|
| `landing`   | Public-facing web services     | landing-page, silex,                 |
| `cms`       | Content Management System      | Directus                             |
| `identity`  | SSO / OAuth2 / LDAP            | Keycloak, LLDAP, Redis, OAuth2-Proxy |
| `media`     | Media server stack             | Jellyfin, Radarr, Sonarr, etc.       |
| `torrent`   | Torrent clients                | qBittorrent + Gluetun                |
| `monitoring`| Prometheus + Grafana           | KPS, Alertmanager, Node Exporter     |
| `spotweb`   | NZB tracker                    | SpotWeb + MariaDB                    |
| `gaming`    | Crafty Controller + Minecraft  | Crafty, crafty-minecraft NodePort    |
| `bitwarden` | Password vault                 | Vaultwarden (community Bitwarden)    |
| `llm`       | Local LLM inference            | ExternalName → 172.16.0.7:8088       |
| `velero`    | Kubernetes backup/restore      | Velero + MinIO                       |
| `security`  | Runtime security (disabled)    | (empty — Falco/Wazuh not deployed)   |
| `nvidia`    | GPU device plugin (disabled)   | (empty — GPU passthrough not used)   |
| `email`     | Email relay (disabled)         | (empty — resources commented out)    |

### Flux Pipeline Status
```
flux-system/apps                  ✓ (homepage)
flux-system/cert-manager-config   ✓
flux-system/flux-system           ✓
flux-system/infrastructure        ✓ (all namespaces)
flux-system/traefik-config        ✓
```

---

*Document generated via audit of current system state.*
*Last manually reviewed: 2026-06-22*
