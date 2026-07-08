# MEMORY.md — Nova's Long-Term Memory

## BeckCloud Infrastructure (Updated 2026-07-08)

**CRITICAL: Read this before any cluster work.** This is the core knowledge I need every session.

### Cluster at a Glance
- **Platform:** K3s v1.32.0+k3s1 on Ubuntu 24.04 VMs (OpenNebula CE 7.2 AIO, AlmaLinux 9 host "becklab")
- **Nodes:** k3s-server (172.16.0.20 / 192.168.100.10) + k3s-worker-1 (192.168.100.11, ProxyJump via server)
- **CNI:** Cilium v1.17.0 with Hubble
- **Ingress:** Traefik v3.4.3 on NodePort :80/:443 → `*.becklab.cloud` domains
- **GitOps:** Flux CD → GitHub `yappingboy/beck-cloud` (main branch, 1m sync)

### Namespaces & Key Services
| NS | Purpose | Key Services |
|----|---------|-------------|
| identity | SSO/Auth | Keycloak 26.0 + LLDAP + oauth2-proxy ×2 + Redis |
| media | Media stack | Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, SABnzbd, nzbget, Tdarr, Homebox, Jellyseerr |
| torrent | Downloads | qBittorrent + Gluetun VPN |
| monitoring | Observability | Prometheus + Grafana (kube-prometheus-stack v65.5.0) |
| bitwarden | Passwords | Vaultwarden BSM (`bw.becklab.cloud`) |
| cms | Headless CMS | Directus 11 (`cms.becklab.cloud`) |
| velero | Backups | Velero v1.15.0 + MinIO (200Gi) |
| gaming | Game servers | Crafty Controller (Minecraft, NodePort :31337→:25565) |

### SSO Architecture
- **Admin chain:** `sso-admin-chain` = oauth2-redirect → keycloak-forwardauth (oauth2-proxy admin tier, requires `/admins` group in LLDAP)
- **Media chain:** `sso-media-chain` = same pattern with separate oauth2-proxy instance for `/media` group
- Keycloak federates to LLDAP via LDAP on port 389

### Storage
- Media: LVM PVs (140+ TiB total across anime/movies/shows/downloads/torrent) — NOT backed up by Velero
- Service configs: local-path provisioner PVCs (~280 GiB total)
- Backups: MinIO 200Gi for Velero object storage

### Backup Strategy (Velero)
- velero-0: identity ns, every 6h, 30d retention
- velero-1: security ns, daily 02:00, 90d retention
- velero-2: media+torrent ns, daily 01:00, 14d retention
- velero-3: cattle-system ns, daily 04:00, 30d retention
- velero-4: ALL namespaces, weekly Sunday 02:00, 90d retention

### Active IngressRoutes (exposed to internet)
- `bw.becklab.cloud` → bitwarden BSM (no SSO)
- `cms.becklab.cloud` → Directus (admin SSO)
- `grafana.becklab.cloud` → Grafana (admin SSO)
- `hubble.becklab.cloud` → Hubble UI (admin SSO)
- `one.becklab.cloud` → OpenNebula Sunstone (admin SSO)
- `silex.becklab.cloud` → Silex design tool (admin SSO)
- `traefik.becklab.cloud` → Traefik dashboard (admin SSO)

### GitOps Structure
- 5 Kustomizations: flux-system, infrastructure (1m), traefik-config, cert-manager-config, apps
- 8 HelmReleases: cert-manager, cilium, traefik, velero, kube-prometheus-stack, homepage, oauth2-proxy ×2
- Secrets encrypted with SOPS + age keys

### Ansible Playbooks (in order)
00-prereqs → 01-zfs/lvm/raid → 02-opennebula → 03-harden → 04-one-vms → 05-k3s → 06-flux → 07-snapshotter → 08-ai-sysadmin → 09-backup-media-nfs → 10-sops-rotate

### Key SSH Details
- Hypervisor: `root@becklab` (AlmaLinux 9)
- K3s master: `ubuntu@172.16.0.20`, key at `/root/.ssh/K3s`
- K3s worker: reachable only via ProxyJump through master

### Documentation Location
Comprehensive docs pushed to GitHub at `docs/research/`:
- system-overview.md (executive summary)
- services-catalog.md (every service detailed)
- networking-ingress.md (Traefik, SSO chains, TLS)
- storage-backups.md (PVs, Velero schedules, capacity)
- gitops-automation.md (Flux pipeline, Ansible, SOPS)
- procedures-runbook.md (ops procedures, troubleshooting)

### Keycloak Monitoring Client (for authenticated API testing)
- Realm: homelab, Client: nova-monitoring, User: yappingboy
- Token URL: https://keycloak.becklab.cloud/realms/homelab/protocol/openid-connect/token
- See TOOLS.md for credentials

### Lessons Learned
1. Don't spawn subagents for data collection — they burn tokens before writing files. Collect + write in same session.
2. kubectl connectivity from the sandbox can drop mid-session. If it does, collect what you can and proceed with cached data.
3. Media services (Jellyfin, Sonarr, etc.) currently have NO IngressRoutes despite having TLS certs — they're internal-only right now. Don't assume they're externally accessible.
