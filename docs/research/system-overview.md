# BeckCloud System Overview

**Last audited:** 2026-07-12  
**Git repo:** `ssh://git@github.com/yappingboy/beck-cloud` (main branch)  
**Docs author:** Nova (AI Sysadmin) — auto-generated from live cluster data

---

## Executive Summary

BeckCloud is a self-hosted private cloud platform running on bare metal hardware, virtualized through OpenNebula CE 7.2, hosting a K3s Kubernetes cluster managed entirely via Flux CD GitOps. It provides SSO-authenticated access to ~40 services across media management, infrastructure monitoring, password vaulting, CMS, email relay, gaming, security, and collaborative wiki — all exposed through Traefik with Let's Encrypt TLS.

### Key Numbers
- **2 K3s nodes** (1 master + 1 worker) on Ubuntu 24.04
- **Kubernetes v1.32.0+k3s1** with Cilium CNI
- **~45 deployments**, ~30 StatefulSets/DaemonSets, all healthy
- **8 HelmReleases** (cert-manager, Traefik, Cilium, Prometheus, Velero, oauth2-proxy ×2)
- **5 Kustomizations** applying manifests from `flux/infrastructure` and `flux/apps`
- **30+ TLS certificates** managed by cert-manager via Let's Encrypt production
- **5 Velero backup schedules** protecting identity, security, media, torrent namespaces + full weekly cluster backups

---

## Infrastructure Stack (Top → Bottom)

```
Internet
  │
  ├── becklab.cloud (external DNS → bare metal IP)
  │
  ▼
Traefik v3.4.3 (NodePort :80/:443) ← Cert-manager + Let's Encrypt
  │
  ├── sso-admin-chain middleware (Keycloak + oauth2-proxy)
  └── sso-media-chain middleware (Keycloak + oauth2-proxy)
        │
        ▼
    K3s Cluster (v1.32.0+k3s1 / Cilium CNI v1.17.0)
      │
      ├── identity:     Keycloak 26.0, LLDAP, oauth2-proxy ×2, Redis
      ├── media:        Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, qBittorrent, etc.
      ├── monitoring:   Prometheus + Grafana (kube-prometheus-stack v65.5.0)
      ├── security:     Wazuh (SIEM), Trivy Operator (VAS)
      ├── bitwarden:    Vaultwarden (BSM)
      ├── cms:          Directus 11
      ├── affine:       Affine wiki/knowledge base (new, ~2026-07-11)
      ├── velero:       Velero v1.15.0 + MinIO (backup storage)
      └── ... (see namespace map below)
        │
        ▼
    OpenNebula VMs (k3s-server, k3s-worker-1)
      │
      ▼
    Bare Metal Host "becklab" — AlmaLinux 9 + OpenNebula CE 7.2 AIO
```

---

## Hypervisor Layer

| Component | Detail |
|-----------|--------|
| **Host** | `becklab` (hostname), bare metal |
| **OS** | AlmaLinux 9 |
| **Virtualization** | OpenNebula CE 7.2 (AIO mode — frontend + KVM node) |
| **Management** | Ansible playbooks (`01-zfs.yml`, `02-opennebula.yml`, etc.) |
| **Storage** | ZFS on host, LVM inside VMs for media storage |

### OpenNebula VMs (K3s Nodes)

| VM Name | Internal IP | External IP | Role | OS | Kernel | Container Runtime |
|---------|-------------|-------------|------|----|--------|-------------------|
| `k3s-server` (`ip-172-16-0-20`) | 192.168.100.10 (cluster) / 172.16.0.20 (LAN) | — | control-plane, master | Ubuntu 24.04.4 LTS | 6.8.0-124-generic | containerd://1.7.23-k3s2 |
| `k3s-worker-1` (`ip-192-168-100-11`) | 192.168.100.11 | — | worker | Ubuntu 24.04.4 LTS | 6.8.0-124-generic | containerd://1.7.23-k3s2 |

> Worker is only reachable via ProxyJump through k3s-server (SSH key at `/root/.ssh/K3s`).

---

## Kubernetes Layer

### Cluster Info
- **API Server:** `https://172.16.0.20:6443`
- **CNI:** Cilium v1.17.0 (with Hubble relay + UI)
- **DNS:** CoreDNS 1.12.0
- **Storage:** K3s local-path-provisioner (default), LVM PVs for media
- **Ingress Controller:** Traefik v3.4.3

### Namespaces & Purpose

| Namespace | Purpose | Key Services | Status |
|-----------|---------|--------------|--------|
| `affine` | Collaborative wiki/knowledge base | Affine server, PostgreSQL, Redis | ✅ Active (new ~2026-07-11) |
| `bitwarden` | Password vaulting | Vaultwarden BSM (vaultwarden/server:latest) | ✅ Active |
| `cert-manager` | TLS certificate management | cert-manager v1.16.5 + cainjector + webhook | ✅ Active |
| `cms` | Headless CMS | Directus 11 | ✅ Active |
| `email` | Outbound email relay | Postfix Relay (Mailgun) | ⚠️ Active, pod issues |
| `flux-system` | GitOps controller | Flux CD source/helm/kustomize/notification controllers | ✅ Active |
| `gaming` | Game servers | Crafty Controller (Minecraft) — NodePort 25565:31337 | ✅ Active |
| `homepage` | Service dashboard | Homepage v1.2.3 | ✅ Active |
| `identity` | Authentication & SSO | Keycloak 26.0, LLDAP, oauth2-proxy ×2, Redis, logout-page, sso-redirect, user-invite | ⚠️ Partial — oauth2-proxies in CrashLoopBackOff |
| `kube-system` | Core K8s + CNI | Cilium operator/envoy/relay/UI, CoreDNS, local-path-provisioner, metrics-server | ✅ Active |
| `landing` | Landing page & design tools | Custom landing page (Node 22), Silex 3.6.6 | ✅ Active |
| `llm` | LLM inference | llama.cpp ExternalName → 172.16.0.7:8088, rho | ✅ Active |
| `media` | Media stack | Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, nzbget, SABnzbd, qBittorrent+Gluetun, Homebox, Tdarr, Recyclarr | ⚠️ Partial — some pods Unknown |
| `monitoring` | Observability | kube-prometheus-stack v65.5.0 (Prometheus + Grafana + Alertmanager) | ✅ Active |
| `nvidia` | GPU support | NVIDIA Device Plugin | ✅ Active |
| `opennebula` | Hypervisor UI proxy | OpenNebula Sunstone | ✅ Active |
| `security` | Security monitoring | Wazuh (Manager, Indexer, Dashboard, Agents) | ✅ Active |
| `spotweb` | NZB search frontend | SpotWeb + MariaDB | ⚠️ Pod issues |
| `toolbox` | Build utilities | Kaniko build pods (user-invite builds) | ✅ Active |
| `torrent` | Torrent downloads | qBittorrent + Gluetun VPN | ⚠️ Partial — pod Unknown |
| `traefik` | Ingress controller | Traefik v3.4.3 | ✅ Active |
| `trivy-system` | Vulnerability scanning | Trivy Operator (continuous image/cluster scanning) | ✅ Active (new ~2026-07-09) |
| `velero` | Backup infrastructure | Velero v1.15.0, MinIO (200Gi local PV) | ✅ Active |

### Service Exposure Map

Currently exposed via Traefik IngressRoutes:

| URL | Namespace | Service | SSO Tier |
|-----|-----------|---------|----------|
| `affine.becklab.cloud` | affine | affine-server:3010 | Admin SSO |
| `bw.becklab.cloud` | bitwarden | bitwarden-secrets-manager:80 | None (Vaultwarden auth) |
| `cms.becklab.cloud` | cms | directus:8055 | Admin SSO |
| `grafana.becklab.cloud` | monitoring | kube-prometheus-stack-grafana:80 | Admin SSO |
| `hubble.becklab.cloud` | monitoring | hubble-ui (kube-system):80 | Admin SSO |
| `one.becklab.cloud` | opennebula | opennebula-sunstone:2616 | Admin SSO |
| `silex.becklab.cloud` | landing | silex:8080 | Admin SSO |
| `traefik.becklab.cloud` | traefik | api@internal (Traefik dashboard) | Admin SSO |

> **Note:** Media services (Jellyfin, Sonarr, etc.), torrent, gaming, homepage have no IngressRoutes currently — they are accessible only within the cluster network or via NodePort. Certificates exist for them but routes were not deployed.

### SSO Architecture

Two middleware chains in `identity` namespace:

**Admin Chain (`sso-admin-chain`):**
1. `oauth2-redirect-admin` → Returns 401 errors to sso-redirect nginx page
2. `keycloak-forwardauth-admin` → Validates against oauth2-proxy (Keycloak backend)

Auth headers forwarded: `X-Auth-Request-User`, `X-Auth-Request-Email`, `X-Auth-Request-Access-Token`, `X-Auth-Request-Groups`, `Authorization`

**Media Chain (`sso-media-chain`):**
1. `oauth2-redirect-media` → Same redirect pattern for media tier
2. `keycloak-forwardauth-media` → Separate oauth2-proxy instance with different group requirements

### TLS Certificates (30+ via cert-manager)

All managed by ClusterIssuer `letsencrypt-prod`. Notable certificates:
- Infrastructure: traefik-dashboard-tls, grafana-tls, hubble-tls, one-tls
- Identity: keycloak-tls, lldap-tls, logout-tls, oauth2-proxy-tls, oauth2-proxy-media-tls
- Media: jellyfin-tls, sonarr-tls, radarr-tls, bazarr-tls, prowlarr-tls, etc. (certificates exist but most IngressRoutes are not yet deployed)
- Applications: bw-tls, cms-tls, homepage-tls, crafty-tls, spotweb-tls, affine-tls

---

## Storage

### Persistent Volumes

| Volume | Size | Access Mode | Namespace | Type | Purpose |
|--------|------|-------------|-----------|------|---------|
| `media-anime-lvm` | 45Ti | RWX | media | LVM PV | Anime library |
| `media-downloads-lvm` | 5Ti | RWX | media | LVM PV | Download staging |
| `media-movies-lvm` | 45Ti | RWX | media | LVM PV | Movie library |
| `media-shows-lvm` | 45Ti | RWX | media | LVM PV | TV show library |
| `torrent-downloads-lvm` | 5Ti | RWX | torrent | LVM PV | Torrent downloads |
| `minio-data` | 200Gi | RWO | velero | LVM PV | Velero backup storage |

### Persistent Volume Claims (local-path)

~30 PVCs on local-path provisioner for service configs: sonarr-config, radarr-config, jellyfin-config, keycloak-postgresql (10Gi), lldap-data (5Gi), prometheus DB (50Gi), grafana data (10Gi), etc. See [Storage & Backups Deep Dive](storage-backups.md) for the full list.

---

## Backup Strategy (Velero v1.15.0)

| Schedule | Cron | Namespaces | Retention | Frequency |
|----------|------|-----------|-----------|-----------|
| `velero-0` | `0 */6 * * *` | identity | 30d (720h) | Every 6 hours |
| `velero-1` | `0 2 * * *` | security | 90d (2160h) | Daily at 02:00 |
| `velero-2` | `0 1 * * *` | media, torrent | 14d (336h) | Daily at 01:00 |
| `velero-3` | `0 4 * * *` | cattle-system | 30d (720h) | Daily at 04:00 |
| `velero-4` | `0 2 * * 0` | ALL namespaces | 90d (2160h) | Weekly Sunday 02:00 |

**Storage:** MinIO S3-compatible backend (`http://minio.velero.svc.cluster.local:9000`)  
**Agent:** node-agent DaemonSet on both nodes for volume snapshots  
**Volumes:** `snapshotVolumes: false`, `defaultVolumesToFsBackup: true` (FS backup mode)

---

## GitOps (Flux CD v1.x)

### Source
- **GitRepo:** `flux-system/flux-system` → `ssh://git@github.com/yappingboy/beck-cloud`
- **Sync interval:** 1 minute

### Kustomizations (5)

| Name | Path | Interval | Purpose |
|------|------|----------|---------|
| `flux-system` | `./flux` | 10m | Core Flux system components |
| `infrastructure` | `./flux/infrastructure` | 1m | All infrastructure services (identity, media, monitoring, etc.) |
| `traefik-config` | `./flux/infrastructure/traefik-config` | 5m | Traefik middleware, security headers, HTTPS redirect |
| `cert-manager-config` | `./flux/infrastructure/cert-manager-config` | 5m | ClusterIssuer for Let's Encrypt |
| `apps` | `./flux/apps` | 5m | User-facing apps (homepage, toolbox, user-invite) |

### HelmReleases (8)

| Namespace/Release | Chart | Version | Source Repo |
|-------------------|-------|---------|-------------|
| `cert-manager/cert-manager` | cert-manager | v1.16.5 | jetstack |
| `homepage/homepage` | homepage | 1.2.3 | homepage |
| `identity/oauth2-proxy` | oauth2-proxy | 7.6.0 | oauth2-proxy |
| `identity/oauth2-proxy-media` | oauth2-proxy | 7.6.0 | oauth2-proxy |
| `kube-system/cilium` | cilium | 1.17.0 | cilium |
| `monitoring/kube-prometheus-stack` | kube-prometheus-stack | 65.5.0 | prometheus-community |
| `traefik/traefik` | traefik | 36.3.0 | traefik |
| `velero/velero` | velero | 8.0.0 | vmware-tanzu |

---

## Ansible Automation

Playbooks in order of execution (numbered for sequencing):

| Playbook | Purpose |
|----------|---------|
| `00-prereqs.yml` | System prerequisites, package installs |
| `01-zfs.yml` / `01-lvm-storage.yml` / `01-raid-storage.yml` | Storage layer (choose one based on hardware) |
| `02-opennebula.yml` | OpenNebula CE installation and configuration |
| `03-harden.yml` | Security hardening |
| `04-one-vms.yml` | Create K3s VM instances via OpenNebula |
| `05-k3s.yml` | Install K3s on VMs, bootstrap cluster |
| `06-flux.yml` | Install Flux CD, configure GitOps sync |
| `07-snapshotter.yml` | CSI Snapshotter setup |
| `08-ai-sysadmin.yml` | AI sysadmin tooling (OpenClaw, etc.) |
| `09-backup-media-nfs.yml` | NFS backup share for media |
| `10-sops-rotate.yml` | SOPS age key rotation |
| `99-uninstall.yml` | Full teardown playbook |

### Ansible Inventory

```yaml
all:
  hypervisor:
    homelab → becklab (AlmaLinux 9, root)
  k3s_nodes:
    k3s-server → 172.16.0.20 (ubuntu, server role)
    k3s-worker-1 → 192.168.100.11 via ProxyJump (ubuntu, worker role)
```

---

## Security Stack

| Component | Namespace | Purpose | Status |
|-----------|-----------|---------|--------|
| Wazuh Manager + Indexer | security | SIEM/XDR hub | ✅ Deployed |
| Wazuh Dashboard | security | Web UI for alerts/correlation | ✅ Deployed (no IngressRoute yet) |
| Wazuh Agents | security | Host monitoring agents (DaemonSet) | ✅ Active on both nodes |
| Trivy Operator | trivy-system | Continuous vulnerability scanning | ✅ Deployed |

> See [Security Suite Plan](security-suite.md) for the full planned architecture including Falco and Suricata.

---

## Service Inventory by Image

### Infrastructure Services
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| cert-manager-controller | quay.io/jetstack/cert-manager-controller:v1.16.5 | 1/1 |
| cert-manager-cainjector | quay.io/jetstack/cert-manager-cainjector:v1.16.5 | 1/1 |
| cert-manager-webhook | quay.io/jetstack/cert-manager-webhook:v1.16.5 | 1/1 |
| traefik | docker.io/traefik:v3.4.3 | 1/1 |
| cilium-operator | quay.io/cilium/operator-generic:v1.17.0 (sha256 pinned) | 1/1 |
| coredns | rancher/mirrored-coredns-coredns:1.12.0 | 1/1 |
| hubble-relay | quay.io/cilium/hubble-relay:v1.17.0 (sha256 pinned) | 1/1 |
| hubble-ui | quay.io/cilium/hubble-ui:v0.13.1 (sha256 pinned) | 1/1 |
| local-path-provisioner | rancher/local-path-provisioner:v0.0.30 | 1/1 |
| metrics-server | registry.k8s.io/metrics-server/metrics-server:v0.8.1 | 1/1 |

### Flux CD Controllers
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| source-controller | ghcr.io/fluxcd/source-controller:v1.4.1 | 1/1 |
| helm-controller | ghcr.io/fluxcd/helm-controller:v1.1.0 | 1/1 |
| kustomize-controller | ghcr.io/fluxcd/kustomize-controller:v1.4.0 | 1/1 |
| notification-controller | ghcr.io/fluxcd/notification-controller:v1.4.0 | 1/1 |

### Identity & SSO
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| keycloak | quay.io/keycloak/keycloak:26.0 | ⚠️ issues |
| keycloak-postgresql (STS) | — | 1/1 |
| lldap | lldap/lldap:stable | 1/1 |
| oauth2-proxy | quay.io/oauth2-proxy/oauth2-proxy:v7.6.0 | ❌ CrashLoopBackOff |
| oauth2-proxy-media | quay.io/oauth2-proxy/oauth2-proxy:v7.6.0 | ❌ CrashLoopBackOff |
| redis (STS) | — | 1/1 |
| logout-page | nginx:alpine | 1/1 |
| sso-redirect | nginx:1.27-alpine | 1/1 |
| user-invite | ghcr.io/yappingboy/becklab-user-invite:v1 | 1/1 (one pod ErrImagePull) |

### Media Stack
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| jellyfin | lscr.io/linuxserver/jellyfin:latest | ⚠️ Unknown |
| sonarr | lscr.io/linuxserver/sonarr:latest | 1/1 |
| radarr | lscr.io/linuxserver/radarr:latest | 1/1 |
| prowlarr | lscr.io/linuxserver/prowlarr:latest | 1/1 |
| bazarr | lscr.io/linuxserver/bazarr:latest | 1/1 |
| nzbget | lscr.io/linuxserver/nzbget:latest | 1/1 |
| sabnzbd | lscr.io/linuxserver/sabnzbd:latest | 1/1 |
| qbit-gluetun (torrent) | lscr.io/linuxserver/qbittorrent:latest | ⚠️ Unknown |
| jellyseerr | seerr/seerr:latest | 1/1 |
| homebox | ghcr.io/sysadminsmedia/homebox:latest | 1/1 |
| tdarr | ghcr.io/haveagitgat/tdarr:latest | ⚠️ Unknown |

### Applications
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| bitwarden-secrets-manager | vaultwarden/server:latest | 0/1 (Running but not ready) |
| directus | directus/directus:11 | 1/1 |
| homepage | ghcr.io/gethomepage/homepage:latest | 1/1 |
| crafty (Minecraft) | registry.gitlab.com/crafty-controller/crafty-4:latest | ⚠️ Running but not ready |
| spotweb | jgeusebroek/spotweb:latest | ⚠️ issues |
| silex | silexlabs/silex:3.6.6 | 1/1 |
| landing-page | node:22-alpine | 1/1 |

### Security
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| wazuh-manager-master-0 | — | 1/1 |
| wazuh-manager-worker-0,1 | — | 1/1 each |
| wazuh-indexer-0 | — | 1/1 |
| wazuh-dashboard | — | 1/1 |
| wazuh-agent (DaemonSet) | — | 2/2 nodes |
| trivy-operator | — | 1/1 + scan jobs running |

### Monitoring
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| kps-operator | quay.io/prometheus-operator/prometheus-operator:v0.77.2 | 1/1 |
| kube-prometheus-stack-grafana | quay.io/kiwigrid/k8s-sidecar:1.28.0 (sidecar) | 1/1 |
| kube-prometheus-stack-kube-state-metrics | registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.13.0 | 1/1 |

### Backup
| Deployment | Image | Ready/Total |
|-----------|-------|-------------|
| velero | velero/velero:v1.15.0 | 1/1 |
| minio | quay.io/minio/minio:latest | 1/1 |

---

## DaemonSets (4)

| Name | Namespace | Pods | Purpose |
|------|-----------|------|---------|
| cilium | kube-system | 2 | CNI network policy enforcement |
| cilium-envoy | kube-system | 2 | Cilium ambient mode proxy |
| kube-prometheus-stack-prometheus-node-exporter | monitoring | 2 | Node metrics collection |
| node-agent | velero | 2 | Velero volume snapshot agent |

---

## Known Issues (as of 2026-07-12)

| Issue | Namespace | Severity | Notes |
|-------|-----------|----------|-------|
| oauth2-proxy CrashLoopBackOff | identity | 🔴 High | Both admin and media tiers crashing — SSO broken for all external services |
| user-invite ErrImagePull | identity | 🟡 Medium | One old pod failing to pull image; newer revision running fine |
| Multiple pods Unknown status | various | 🟡 Medium | Likely worker node communication issue (pods on ip-192-168-100-11) |
| Wazuh manager pods restarting frequently | security | 🟡 Medium | Master pod has 641+ restarts; workers have 643+ restarts |
| SpotWeb unstable | spotweb | 🟢 Low | Pod shows as Running but not Ready, high restart count |

---

*End of system overview. Updated from live cluster data 2026-07-12.*
