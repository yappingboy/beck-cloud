# Beck Cloud System Topology
**Last Updated:** 2026-06-04  
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
| `traefik:30080,30443`      | NodePort       | traefik      | NodePort    |
| `llamactl`                 | 172.16.0.7:8088| llm          | ExternalName|

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
                       
| PVC NAME                                                          | NAMESPACE | CAPACITY | APPS                             |                                         |
|-----------------------------------                                |-----------|----------|----------------------------------|                                         |
| `pvc-d51d09a2-591d-452b-...`                                      | bitwarden | 10Gi     | bitwarden-secrets-manager        |                                         |
| `pvc-4530cbbe-eb46-4560-...`                                      | cms       | 2Gi      | directus                         |                                         |
| `data-keycloak-postgresql-0`                                      | identity  | 10Gi     | keycloak (Postgres 16)           |                                         |
| `data-redis-0`                                                    | identity  | 1Gi      | redis session store              |                                         |
| `lldap-data`                                                      | identity  | 5Gi      | lldap                            |                                         |
| `silex-hosting`                                                   | landing   | 4Gi      | silex-platform                   |                                         |
| `silex-root`                                                      | landing   | 4Gi      | silex-platform                   |                                         |
| `bazarr-config`                                                   | media     | 5Gi      | bazarr                           |                                         |
| `homebox-config`                                                  | media     | 10Gi     | homebox                          |                                         |
| `jellyfin-config`                                                 | media     | 20Gi     | jellyfin                         |                                         |
| `jellyseerr-config`                                               | media     | 10Gi     | jellyseerr                       |                                         |
| `nzbget-config`                                                   | media     | 5Gi      | nzbget                           |                                         |
| `prowlarr-config`                                                 | media     | 5Gi      | prowlarr                         |                                         |
| `radarr-config`                                                   | media     | 10Gi     | radarr                           |                                         |
| `sonarr-config`                                                   | media     | 10Gi     | sonarr                           |                                         |
| `tdarr-config`                                                    | media     | 5Gi      | tdarr                            |                                         |
| `alertmanager-kps-alertmanager-db-alertmanager-kps-alertmanager-0`|monitoring |5Gi       | alertmanager                     |                                         |
| `prometheus-kps-prometheus-db-prometheus-kps-prometheus-0`        | monitoring|50Gi      | prometheus                       |                                         |
| `data-mariadb-0`                                                  | spotweb   | 5Gi      | mariadb                          |                                         |
| `spotweb-config`                                                  | spotweb   | 1Gi      | spotweb                          |                                         |
| `qbit-config`                                                     | torrent   | 5Gi      | qBittorrent                      |                                         |
| `minio-data`                                                      | velero    | 200Gi    | MinIO (Velero backups)           |                                         |

### Local-Path StorageClass

All PVCs use `local-path` StorageClass except:
- `media-anime-lvm`, `media-movies-lvm`, `media-shows-lvm`, `media-downloads-lvm`, `torrent-downloads-lvm`: Custom LVM on md0
- `minio-data`: Custom provisioned by MinIO

---

## Image Registry Sources

### Flux-Managed Application Images

| IMAGE                                    | SOURCE                                    |
|------------------------------------------|-------------------------------------------|
| `lldap/lldap:stable`                     | LLDAP official                            |
| `nginx:alpine`                           | DockerHub                                 |
| `nginx:1.27-alpine`                      | DockerHub                                 |
| `postgres:16`                            | DockerHub                                 |
| `quay.io/keycloak/keycloak:26.0`         | Quay                                      |
| `redis:7-alpine`                         | DockerHub                                 |
| `node:20-bookworm-slim`                  | DockerHub                                 |
| `lscr.io/linuxserver/bazarr:latest`      | LinuxServer.io (Docker Hub proxy)         |
| `lscr.io/linuxserver/jellyfin:latest`    | LinuxServer.io                            |
| `lscr.io/linuxserver/prowlarr:latest`    | LinuxServer.io                            |
| `ghcr.io/recyclarr/recyclarr:latest`     | GitHub Container Registry                 |
| `lscr.io/linuxserver/nzbget:latest`      | LinuxServer.io                            |
| `lscr.io/linuxserver/sonarr:latest`      | LinuxServer.io                            |
| `lscr.io/linuxserver/radarr:latest`      | LinuxServer.io                            |
| `qmcgaw/gluetun:latest`                  | GitHub Container Registry                 |
| `lscr.io/linuxserver/qbittorrent:latest` | LinuxServer.io                            |
| `seerr/seerr:latest`                     | GitHub Container Registry                 |
| `ghcr.io/haveagitgat/tdarr:latest`       | GitHub Container Registry                 |
| `ghcr.io/sysadminsmedia/homebox:latest`  | GitHub Container Registry                 |
| `silexlabs/silex-platform`               | DockerHub                                 |
| `debian:bookworm-slim`                   | DockerHub                                 |
| `node:22-alpine`                         | DockerHub                                 |
| `lscr.io/linuxserver/vsftpd:latest`      | LinuxServer.io                            |
| `directus/directus:11`                   | DockerHub                                 |
| `mwader/postfix-relay:latest`            | GitHub Container Registry                 |
| `mariadb:11`                             | DockerHub                                 |
| `jgeusebroek/spotweb:latest`             | GitHub Container Registry                 |
| `bitwarden/secrets-manager:latest`       | DockerHub                                 |
| `quay.io/minio/minio:latest`             | Quay                                      |
| `quay.io/minio/mc:latest`                | Quay                                      |

### Flux CD Images

| IMAGE                                           |
|-------------------------------------------------|
| `ghcr.io/fluxcd/source-controller:v1.4.1`       |
| `ghcr.io/fluxcd/kustomize-controller:v1.4.0`    |
| `ghcr.io/fluxcd/helm-controller:v1.1.0`         |
| `ghcr.io/fluxcd/notification-controller:v1.4.0` |

---

## Network Topology

### Node Configuration
- **Server Node:** 192.168.100.10 / mgmt:172.16.0.20
- **Worker Node:** 192.168.100.11 / mgmt:172.16.0.7

### Networking Stack
- **CNI:** Cilium 1.17 (VXLAN overlay)
- **Kube-proxy mode:** `kube-proxy-replaced` (Cilium BPF)
- **Service Mesh:** Hubble (traffic visibility)
- **DNS:** CoreDNS (10.43.0.10) + k3s coredns

### Ingress Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Traefik Ingress Controller                │
│                  (namespace: traefik)                        │
│              External: :30080 (HTTP), :30443 (HTTPS)        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌──────────────┐
│ Public        │   │ SSO Chain     │   │ Internal     │
│ Pages         │   │ + SSO         │   │ Services     │
└───────┬───────┘   └───────┬───────┘   └───────┬──────┘
        │                   │                   │
        ▼                   ▼                   ▼
  landing           oauth2-proxy          keycloak
  homepage         oauth2-proxy-media
```

### SSO Flow
```
User → [App Subdomain] → oauth2-proxy → keycloak → redis → [App]
                        ↕ (proxy chain)
                  oauth2-proxy-media → jellyfin
```

---

## Application Architecture by Namespace

### 🏠 landing (Public Facing)
```
┌────────────────────────────────────────────┐
│ backend: node:22-alpine                    │
│       svc: landing-page:80                 │
│       ingress: becklab.cloud               │
└────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────------─┐
│ hosting: silex-platform (PHP)                    │
│       PVCs: silex-hosting (4Gi), silex-root(4Gi) │
└───────────────────────────────────────────------─┘
```

### 🔐 identity (SSO + Identity)
┌──────────────────────────────────────────────────────┐
│ keycloak: quay.io/keycloak/keycloak:26.0             │
│       svc: keycloak:8080                             │
│       svc: keycloak:8080                             │
│       ingress: keycloak.becklab.cloud                │
│       PVC: data-keycloak-postgresql-0 (10Gi)         │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ lldap: lldap/lldap:stable                            │
│       svc: lldap:389,17170                           │
│       ingress: lldap.becklab.cloud                   │
│       PVC: lldap-data (5Gi)                          │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ redis: redis:7-alpine                                │
│       svc: redis:6379                                │
│       PVC: data-redis-0 (1Gi)                        │
└──────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────┐
│ oauth2-proxy: 7.6.0 (x2 instances)                   │
│       - admin (oauth2.becklab.cloud)                 │
│       - media (oauth2-media.becklab.cloud)           │
│       svc: oauth2-proxy:80,44180                     │
│       svc: oauth2-proxy-media:80,44180               │
└──────────────────────────────────────────────────────┘
```

### 📺 media (Jellyfin Stack)
```
┌──────────────────────────────────────────────┐
│ jellyfin: lscr.io/linuxserver/jellyfin       │
│       svc: jellyfin:8096                     │
│       ingress: jellyfin.becklab.cloud        │
│       PVCs: jellyfin-config (20Gi)           │
│       shared: media-movies-lvm, anime, shows │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ jellyseerr: seerr/seerr:latest               │
│       svc: jellyseerr:5055                   │
│       ingress: requests.becklab.cloud        │
│       PVC: jellyseerr-config (10Gi)          │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ radarr: lscr.io/linuxserver/radarr           │
│       svc: radarr:7878                       │
│       ingress: radarr.becklab.cloud          │
│       PVC: radarr-config (10Gi)              │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ sonarr: lscr.io/linuxserver/sonarr           │
│       svc: sonarr:8989                       │
│       ingress: sonarr.becklab.cloud          │
│       PVC: sonarr-config (10Gi)              │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ bazarr: lscr.io/linuxserver/bazarr           │
│       svc: bazarr:6767                       │
│       ingress: bazarr.becklab.cloud          │
│       PVC: bazarr-config (5Gi)               │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ homebox: ghcr.io/sysadminsmedia/homebox      │
│       svc: homebox:7745                      │
│       ingress: homebox.becklab.cloud         │
│       PVC: homebox-config (10Gi)             │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ prowlarr: lscr.io/linuxserver/prowlarr       │
│       svc: prowlarr:9696                     │
│       ingress: prowlarr.becklab.cloud        │
│       PVC: prowlarr-config (5Gi)             │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ nzbget: lscr.io/linuxserver/nzbget           │
│       svc: nzbget:6789                       │
│       ingress: nzbget.becklab.cloud          │
│       PVC: nzbget-config (5Gi)               │
│       shared: media-downloads-lvm (5Ti)      │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ tdarr: ghcr.io/haveagitgat/tdarr             │
│       svc: tdarr:8265                        │
│       ingress: tdarr.becklab.cloud           │
│       PVC: tdarr-config (5Gi)                │
└──────────────────────────────────────────────┘
```

### 📊 monitoring
```
┌──────────────────────────────────────────────────┐
│ prometheus: kps-prometheus                       │
│       PVC: prometheus-kps-prometheus-db (50Gi)   │
└──────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────┐
│ grafana: kube-prometheus-stack-grafana           │
│       PVC: kube-prometheus-stack-grafana (10Gi)  │
└──────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────┐
│ alertmanager: kps-alertmanager                   │
└──────────────────────────────────────────────────┘
```

### 🎮 spotweb
```
┌──────────────────────────────────────────────┐
│ spotweb: jgeusebroek/spotweb:latest          │
│       ingress: spotweb.becklab.cloud         │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ mariadb: mariadb:11                          │
│       PVC: data-mariadb-0 (5Gi)              │
└──────────────────────────────────────────────┘
```

### 📥 torrent
```
┌──────────────────────────────────────────────┐
│ qbit-gluetun: lscr.io/linuxserver/qbittorrent│
│       ingress: qbit.becklab.cloud            │
│       shared: torrent-downloads-lvm (5Ti)    │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ gluetun: qmcgaw/gluetun:latest               │
│       (OpenVPN/WireGuard client)             │
└──────────────────────────────────────────────┘
```

### 💾 velero
```
┌──────────────────────────────────────────────┐
│ minio: quay.io/minio/minio:latest            │
│       PVC: minio-data (200Gi)                │
└──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────┐
│ velero: velero/velero-plugin-for-aws:v1.10.0 │
└──────────────────────────────────────────────┘
```

---

## Issues & TODOs

### ✅ Fixed (2026-06-04)

2. **bitwarden** - WAS ImagePullBackOff
   - **Root cause:** `bitwarden/secrets-manager:latest` requires Docker Hub auth (private)
   - **Fix:** Replaced with `vaultwarden/server:latest` (community Bitwarden impl)
   - **Status:** Running 1/1

3. **tdarr** - WAS no image tag + wrong timezone
   - **Root cause:** `ghcr.io/haveagitgat/tdarr` (no tag), TZ=America/Los_Angeles
   - **Fix:** Added `:latest` tag, changed TZ to America/New_York
   - **Status:** Running 1/1

### 🟡 High Priority

4. **Empty namespaces** (defined but no workloads)
   - `gaming` — commented out in kustomization.yaml
   - `email` — resources commented out (postfix-relay, secret-mailu)
   - `security` — Falco/Wazuh disabled (documented in kustomization)
   - `nvidia` — device plugin commented out (GPU passthrough not used)
   - `llm` — only ExternalName service (actual LLM on host)
   - `opennebula` — service only (points to VM on hypervisor)
   - `cilium-secrets`, `default`, `kube-*` — system namespaces

5. **Namespace organization**
   - `media` + `torrent` — related but separate → consider consolidating
   - `identity` — well-organized (SSO stack)

6. **Local-Path StorageClass dependency**
   - Most PVCs use node-local storage → single point of failure
   - Databases (PostgreSQL, MariaDB, Redis) all on `local-path`
   - **Risk:** If worker node dies, data is lost

### 🟢 Medium Priority

7. **Siloed OAuth2 proxies**
   - Two separate oauth2-proxy instances (admin + media)
   - **Recommendation:** Document the split clearly

---

## Remediation Log


### bitwarden Fix
```bash
# deployment.yaml image changed:
#   FROM: bitwarden/secrets-manager:latest
#   TO:   vaultwarden/server:latest
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
| `bitwarden` | Password vault                 | Vaultwarden (community Bitwarden)    |
| `llm`       | Local LLM inference            | ExternalName → 172.16.0.7:8088       |
| `velero`    | Kubernetes backup/restore      | Velero + MinIO                       |
| `security`  | Runtime security (disabled)    | (empty — Falco/Wazuh not deployed)   |
| `nvidia`    | GPU device plugin (disabled)   | (empty — GPU passthrough not used)   |
| `gaming`    | Game servers (disabled)        | (empty — commented out)              |
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
*Last manually reviewed: 2026-06-04*
