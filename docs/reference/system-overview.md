# BeckCloud System Overview

**Last audited:** 2026-07-20  
**Git repo:** `ssh://git@github.com/yappingboy/beck-cloud` (main branch)  
**Docs author:** Nova (AI Sysadmin) — auto-generated from live cluster data

---

## Executive Summary

BeckCloud is a self-hosted private cloud platform running on bare metal hardware, virtualized through OpenNebula CE 7.2, hosting a K3s Kubernetes cluster managed entirely via Flux CD GitOps. It provides SSO-authenticated access to ~45 services across media management, infrastructure monitoring, password vaulting, CMS, email relay, gaming, security, 3D printing, collaborative wiki, and home automation — all exposed through Traefik with Let's Encrypt TLS.

### Key Numbers
- **2 K3s nodes** (1 master + 1 worker) on Ubuntu 24.04
- **Kubernetes v1.32.0+k3s1** with Cilium CNI
- **~40 deployments**, ~10 StatefulSets, ~7 DaemonSets, all healthy
- **11 HelmReleases** (cert-manager, Traefik, Cilium, Prometheus, Velero, oauth2-proxy ×2, Trivy Operator, Wazuh, Homepage, Crowdsec)
- **5 Kustomizations** applying manifests from `flux/infrastructure` and `flux/apps`
- **44 TLS certificates** managed by cert-manager via Let's Encrypt production
- **5 Velero backup schedules** protecting identity, security, media namespaces + full weekly cluster backups

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
  ├── crowdsec-bouncer middleware (global WAF, stream mode)
  ├── sso-admin-chain middleware (Keycloak + oauth2-proxy)
  ├── sso-admin-chain-no-auth-header middleware (Keycloak + oauth2-proxy)
  └── sso-media-chain middleware (Keycloak + oauth2-proxy)
        │
        ▼
    K3s Cluster (v1.32.0+k3s1 / Cilium CNI v1.17.0)
      │
      ├── identity:     Keycloak 26.0, LLDAP, oauth2-proxy ×2, Redis, logout-page, sso-redirect, user-invite, Postfix relay
      ├── webapps:      Affine, Bitwarden BSM, Directus, Home Assistant, Homepage, Landing page, Silex, OpenClaw
      ├── media:        Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, qBittorrent+Gluetun, Homebox, Tdarr, Jellyseerr, SABnzbd, nzbget, SpotWeb, MariaDB
      ├── monitoring:   Prometheus + Grafana (kube-prometheus-stack v65.5.0)
      ├── security:     Wazuh (SIEM), Trivy Operator (VAS), Suricata (IDS)
      ├── crowdsec:     Crowdsec LAPI + Agents + Traefik Bouncer (WAF)
      ├── 3dprinting:   Manyfold, FDM Monster, Spoolman, OrcaSlicer, BumpMesh
      ├── gridspace:    Gridspace (custom 3D tool)
      ├── gaming:       Crafty Controller (Minecraft)
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
| `k3s-server` (`ip-172-16-0-20`) | 192.168.100.10 (cluster) / 172.16.0.20 (LAN) | — | control-plane, master | Ubuntu 24.04.4 LTS | 6.8.0-134-generic | containerd://1.7.23-k3s2 |
| `k3s-worker-1` (`ip-192-168-100-11`) | 192.168.100.11 | — | worker | Ubuntu 24.04.4 LTS | 6.8.0-134-generic | containerd://1.7.23-k3s2 |

> **Updated:** Kernel upgraded from 6.8.0-124-generic to 6.8.0-134-generic on both nodes.  
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
| `3dprinting` | 3D printing management | Manyfold, FDM Monster, Spoolman, OrcaSlicer, BumpMesh | ✅ Active (new ~2026-07-16) |
| `affine` | *(empty — migrated to `webapps`)* | — | ⚠️ Empty namespace |
| `bitwarden` | *(empty — migrated to `webapps`)* | — | ⚠️ Empty namespace |
| `cert-manager` | TLS certificate management | cert-manager v1.16.5 + cainjector + webhook | ✅ Active |
| `cilium-secrets` | Cilium ambient mode secrets | — | ✅ Active |
| `cms` | *(empty — migrated to `webapps`)* | — | ⚠️ Empty namespace |
| `crowdsec` | WAF + IP reputation | Crowdsec LAPI, Crowdsec Agents, Traefik Bouncer middleware | ✅ Active (new 2026-07-20) |
| `default` | Default namespace | — | ✅ Active |
| `email` | *(empty — migrated to `identity`)* | — | ⚠️ Empty namespace |
| `flux-system` | GitOps controller | Flux CD source/helm/kustomize/notification controllers | ✅ Active |
| `gaming` | Game servers | Crafty Controller (Minecraft) — NodePort 25565:31337 | ✅ Active |
| `gridspace` | 3D design platform | Gridspace custom app | ✅ Active (new ~2026-07-16) |
| `homepage` | *(empty — migrated to `webapps`)* | — | ⚠️ Empty namespace |
| `identity` | Authentication & SSO + email relay | Keycloak 26.0, LLDAP, oauth2-proxy ×2, Redis, logout-page, sso-redirect, user-invite, Postfix relay | ✅ Active — all healthy |
| `kube-node-lease` | Kubernetes node leases | — | ✅ Active |
| `kube-public` | Public K8s resources | — | ✅ Active |
| `kube-system` | Core K8s + CNI | Cilium operator/envoy/relay/UI, CoreDNS, local-path-provisioner, metrics-server | ✅ Active |
| `landing` | *(empty — migrated to `webapps`)* | — | ⚠️ Empty namespace |
| `llm` | LLM inference | llama.cpp ExternalName → 172.16.0.7:8088, rho | ✅ Active |
| `media` | Media stack + downloaders + NZB | Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, nzbget, SABnzbd, qBittorrent+Gluetun, Homebox, Tdarr, Jellyseerr, SpotWeb, MariaDB | ✅ Active |
| `monitoring` | Observability | kube-prometheus-stack v65.5.0 (Prometheus + Grafana + Alertmanager) | ✅ Active |
| `nvidia` | GPU support | NVIDIA Device Plugin | ✅ Active |
| `opennebula` | Hypervisor UI proxy | OpenNebula Sunstone | ✅ Active |
| `security` | Security monitoring | Wazuh (Manager, Indexer, Dashboard, Agents), Trivy Operator, Suricata (IDS) | ✅ Active |
| `spotweb` | *(empty — migrated to `media`)* | — | ⚠️ Empty namespace |
| `toolbox` | Build utilities | Kaniko build pods (user-invite builds) | ✅ Active |
| `torrent` | *(empty — migrated to `media`)* | — | ⚠️ Empty namespace |
| `traefik` | Ingress controller | Traefik v3.4.3 | ✅ Active |
| `trivy-system` | *(empty — migrated to `security`)* | — | ⚠️ Empty namespace |
| `velero` | Backup infrastructure | Velero v1.15.0, MinIO (200Gi local PV) | ✅ Active |
| `webapps` | Consolidated web applications | Affine, Bitwarden BSM, Directus, Home Assistant, Homepage, Landing page, Silex, OpenClaw | ✅ Active (new ~2026-07-15) |

### Service Exposure Map

Currently exposed via Traefik IngressRoutes:

| URL | Namespace | Service | SSO Tier |
|-----|-----------|---------|----------|
| `affine.becklab.cloud` | webapps | affine-server | Admin SSO |
| `bw.becklab.cloud` | webapps | bitwarden-secrets-manager:80 | None (Vaultwarden auth) |
| `cms.becklab.cloud` | webapps | directus:8055 | Admin SSO |
| `grafana.becklab.cloud` | monitoring | kube-prometheus-stack-grafana:80 | Admin SSO |
| `ha.becklab.cloud` | webapps | home-assistant | Admin SSO (no-auth-header variant) |
| `hubble.becklab.cloud` | monitoring | hubble-ui (kube-system):80 | Admin SSO |
| `kiri.becklab.cloud` | gridspace | kiri-moto | None |
| `mesh.becklab.cloud` | gridspace | mesh-tool | None |
| `nova.becklab.cloud` | webapps | openclaw | Admin SSO |
| `one.becklab.cloud` | opennebula | opennebula-sunstone:2616 | Admin SSO |
| `silex.becklab.cloud` | webapps | silex:8080 | Admin SSO |
| `traefik.becklab.cloud` | traefik | api@internal (Traefik dashboard) | Admin SSO |
| `void.becklab.cloud` | gridspace | void-form | None |

> **Note:** Media services (Jellyfin, Sonarr, etc.) have no IngressRoutes — accessible only within the cluster network. Certificates exist for most but routes not yet deployed.

### SSO Architecture

Two middleware chain families in `identity` namespace:

**Admin Chain (`sso-admin-chain`):**
1. `oauth2-redirect-admin` → Returns 401 errors to sso-redirect nginx page
2. `keycloak-forwardauth-admin` → Validates against oauth2-proxy (Keycloak backend)

**Admin Chain — No Auth Header (`sso-admin-chain-no-auth-header`):**
1. `oauth2-redirect-admin` → Same redirect pattern
2. `keycloak-forwardauth-admin-no-auth-header` → ForwardAuth without Authorization header passthrough (used by Home Assistant)

**Media Chain (`sso-media-chain`):**
1. `oauth2-redirect-media` → Same redirect pattern for media tier
2. `keycloak-forwardauth-media` → Separate oauth2-proxy instance with different group requirements

Auth headers forwarded: `X-Auth-Request-User`, `X-Auth-Request-Email`, `X-Auth-Request-Access-Token`, `X-Auth-Request-Groups`, `Authorization`

### TLS Certificates (44 via cert-manager)

All managed by ClusterIssuer `letsencrypt-prod`. Notable certificates:

- **Infrastructure:** traefik-dashboard-tls, grafana-tls, hubble-tls, one-tls
- **Identity:** keycloak-tls, lldap-tls, logout-tls, oauth2-proxy-tls, oauth2-proxy-media-tls, mail-becklab, user-invite-tls
- **Media:** bazarr-tls, homebox-tls, jellyfin-tls, jellyseerr-tls, nzbget-tls, prowlarr-tls, qbit-tls, radarr-tls, sabnzbd-tls, sonarr-tls, spotweb-tls, tdarr-tls
- **Webapps:** affine-tls, bw-tls, cms-tls, home-assistant-tls, homepage-tls, landing-tls, nova-tls, silex-tls
- **3D Printing:** bumpmesh-tls, fdmmonster-tls, manyfold-tls, orcaslicer-tls, spoolman-tls
- **Gridspace:** kiri-tls, mesh-tls, void-tls
- **Security:** wazuh-becklab-cloud-tls
- **Gaming:** crafty-tls
- **Monitoring:** alertmanager-tls, prometheus-tls

---

## Storage

### Persistent Volumes

| Volume | Size | Access Mode | Namespace | Type | Purpose |
|--------|------|-------------|-----------|------|---------|
| `media-anime-lvm` | 45Ti | RWX | media | LVM PV | Anime library |
| `media-downloads-lvm` | 5Ti | RWX | media | LVM PV | Download staging |
| `media-movies-lvm` | 45Ti | RWX | media | LVM PV | Movie library |
| `media-shows-lvm` | 45Ti | RWX | media | LVM PV | TV show library |
| `minio-data` | 200Gi | RWO | velero | LVM PV | Velero backup storage |
| `torrent-downloads-lvm` | 5Ti | RWX | *(released)* | LVM PV | Torrent downloads (released — torrent namespace empty) |

### Persistent Volume Claims (local-path)

~55 PVCs on local-path provisioner across all namespaces. See [Storage & Backups Deep Dive](storage-backups.md) for the full list.

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
- **Current revision:** `main@sha1:95534aa012df7a5e0e0b17bc61f3bac3f0fed034`

### Kustomizations (5)

| Name | Path | Interval | Purpose |
|------|------|----------|---------|
| `flux-system` | `./flux` | 10m | Core Flux system components |
| `infrastructure` | `./flux/infrastructure` | 1m | All infrastructure services (identity, media, monitoring, etc.) |
| `traefik-config` | `./flux/infrastructure/traefik-config` | 5m | Traefik middleware, security headers, HTTPS redirect |
| `cert-manager-config` | `./flux/infrastructure/cert-manager-config` | 5m | ClusterIssuer for Let's Encrypt |
| `apps` | `./flux/apps` | 5m | User-facing apps (homepage, toolbox, user-invite) |

### HelmReleases (10)

| Namespace/Release | Chart | Source Repo | Status |
|-------------------|-------|-------------|--------|
| `cert-manager/cert-manager` | cert-manager v1.16.5 | jetstack | ✅ True |
| `webapps/homepage` | homepage | gethomepage | ✅ True |
| `identity/oauth2-proxy` | oauth2-proxy v7.6.0 | oauth2-proxy | ✅ True |
| `identity/oauth2-proxy-media` | oauth2-proxy v7.6.0 | oauth2-proxy | ✅ True |
| `kube-system/cilium` | cilium v1.17.0 | cilium | ✅ True |
| `monitoring/kube-prometheus-stack` | kube-prometheus-stack v65.5.0 | prometheus-community | ✅ True |
| `security/trivy-operator` | trivy-operator v0.30.0 | aquasecurity | ✅ True |
| `security/wazuh` | wazuh v4.14.3 | morgoved | ✅ True |
| `traefik/traefik` | traefik v36.3.0 | traefik | ✅ True |
| `velero/velero` | velero v8.0.0 | vmware-tanzu | ✅ True |
| `crowdsec/crowdsec` | crowdsec v0.20.0 | crowdsec | ✅ True |

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
| Wazuh Manager + Indexer | security | SIEM/XDR hub | ✅ Deployed — stable |
| Wazuh Dashboard | security | Web UI for alerts/correlation | ✅ Deployed (no IngressRoute yet) |
| Wazuh Agents | security | Host monitoring agents (DaemonSet) | ✅ Active on both nodes |
| Suricata | security | IDS — network traffic inspection (DaemonSet) | ✅ Deployed 2/2 running |
| Trivy Operator | security | Continuous vulnerability scanning | ✅ Deployed (migrated from trivy-system) |
| Crowdsec | crowdsec | WAF — behavioral analysis + IP reputation, Traefik bouncer | ✅ Deployed (LAPI + agents + bouncer plugin) |

> See [Security Suite Plan](security-suite.md) for the full planned architecture including Falco.

---

## Resource Usage

| Node | CPU | CPU% | Memory | Memory% |
|------|-----|------|--------|---------|
| `ip-172-16-0-20` (master) | 624m | 8% | 11,100Mi | 39% |
| `ip-192-168-100-11` (worker) | 3,384m | 14% | 23,369Mi | 53% |

---

## DaemonSets (7)

| Name | Namespace | Pods | Purpose |
|------|-----------|------|---------|
| cilium | kube-system | 2 | CNI network policy enforcement |
| cilium-envoy | kube-system | 2 | Cilium ambient mode proxy |
| crowdsec-agent | crowdsec | 2 | WAF log collection (Traefik acquisition) |
| kube-prometheus-stack-prometheus-node-exporter | monitoring | 2 | Node metrics collection |
| suricata | security | 2 | IDS network traffic inspection |
| wazuh-agent | security | 2 | Host monitoring agents |
| node-agent | velero | 2 | Velero volume snapshot agent |

---

## Known Issues (as of 2026-07-20)

| Issue | Namespace | Severity | Notes |
|-------|-----------|----------|-------|
| Multiple empty namespaces | various | 🟢 Low | Old namespaces (affine, bitwarden, cms, homepage, landing, email, spotweb, torrent, trivy-system) still exist but are empty after migration to webapps/media/security |
| torrent-downloads-lvm PV Released | torrent | 🟢 Low | PV in Released state — torrent namespace emptied, qbit moved to media |
| Velero self-backup restic jobs failing | velero | 🟡 Medium | `velero-default-restic` maintain jobs repeatedly entering Error state |

---

*End of system overview. Updated from live cluster data 2026-07-20.*
