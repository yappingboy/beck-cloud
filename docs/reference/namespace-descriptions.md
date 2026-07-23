# Namespace Descriptions

**Last updated:** 2026-07-21  
**Scope:** Purpose and service inventory for each Kubernetes namespace

---

## System Namespaces

### `flux-system`

Flux CD controllers and GitOps configuration. Self-managing — Flux manages its own manifests.

| Service | Purpose |
|---------|---------|
| Flux controllers | Core GitOps reconciliation engine |
| ConfigMap `beck-cloud-config` | Variable substitution (domain, versions, IPs) |
| GitRepository `beck-cloud` | Source reference to GitHub repo |

### `cert-manager`

TLS certificate management via Let's Encrypt.

| Service | Purpose |
|---------|---------|
| cert-manager | Automatic certificate provisioning and renewal |

### `cert-manager-config`

ClusterIssuer definitions for Let's Encrypt production and staging.

### `kube-system`

K3s core system components (managed by K3s, not Flux).

| Service | Purpose |
|---------|---------|
| Cilium | eBPF CNI, network policies, service mesh |
| CoreDNS | Cluster-internal DNS resolution |
| Metrics server | Resource usage metrics for HPA |
| local-path-provisioner | Dynamic PVC provisioning on host filesystem |

---

## Application Namespaces

### `traefik`

Edge reverse proxy and load balancer. All external traffic enters here.

| Service | Purpose |
|---------|---------|
| Traefik v3.4.3 | Ingress controller, TLS termination, routing |
| Dashboard | Internal Traefik admin UI |
| Middlewares | SSO chains, Crowdsec bouncer, rate limiting |

### `identity`

Authentication, authorization, and user management.

| Service | Purpose |
|---------|---------|
| Keycloak 26.0 | Identity provider, OAuth2/OIDC SSO |
| LLDAP | Lightweight LDAP directory |
| oauth2-proxy (×2) | Admin chain and media chain SSO gateways |
| Redis | Session/cache backend for Keycloak |
| Logout page | Custom SSO logout handler |
| SSO redirect | Centralized SSO redirect service |
| Postfix relay | Email notifications for password resets, etc. |

### `security`

Security monitoring and vulnerability scanning.

| Service | Purpose |
|---------|---------|
| Wazuh | SIEM, log analysis, intrusion detection |
| Trivy Operator | Container image and filesystem vulnerability scanning |
| Suricata | Network intrusion detection (IDS) |
| Falco | Runtime security monitoring (defined, deployment varies) |

### `crowdsec`

Cloud-native WAF and threat intelligence.

| Service | Purpose |
|---------|---------|
| Crowdsec LAPI | Central decision engine and log collection |
| Traefik Bouncer | Middleware that blocks IPs flagged by Crowdsec |

### `monitoring`

Observability and metrics.

| Service | Purpose |
|---------|---------|
| Prometheus | Metrics collection and storage |
| Grafana | Dashboards and visualization |
| Hubble | Cilium network observability UI |

### `media`

Media server and download management stack.

| Service | Purpose |
|---------|---------|
| Jellyfin | Media streaming server |
| Jellyseerr | Media request/discovery interface |
| Sonarr | TV show management and downloading |
| Radarr | Movie management and downloading |
| Prowlarr | Indexer management (shared by Sonarr/Radarr) |
| Bazarr | Subtitle management |
| qBittorrent + Gluetun | Torrent downloading with VPN tunnel |
| SABnzbd | NZB downloading |
| nzbget | Alternative NZB downloader |
| Tdarr | Media transcoding/optimization |
| Homebox | Digital asset/potion management |
| MariaDB | Database for media apps |

### `webapps`

User-facing web applications.

| Service | Purpose |
|---------|---------|
| Affine | Collaborative wiki/note-taking |
| Bitwarden BSM | Password vault |
| Directus | Headless CMS |
| Home Assistant | Home automation |
| Homepage | Dashboard/service launcher |
| Landing page | BeckCloud public-facing website |
| Silex | Static site generator (feeds landing page) |
| OpenClaw | AI assistant platform |

### `velero`

Backup and disaster recovery.

| Service | Purpose |
|---------|---------|
| Velero | Kubernetes backup/restore engine |
| MinIO | Object storage for Velero backups |

### `opennebula`

Hypervisor management UI.

| Service | Purpose |
|---------|---------|
| Sunstone | OpenNebula web dashboard (proxy) |

### `gaming`

Gaming infrastructure.

| Service | Purpose |
|---------|---------|
| Crafty Controller | Minecraft server management |

### `3dprinting`

3D printing management stack.

| Service | Purpose |
|---------|---------|
| Manyfold | Print library management |
| FDM Monster | Slicer and print profiles |
| Spoolman | Filament inventory tracking |
| OrcaSlicer | Cloud-based slicing |
| BumpMesh | Mesh generation tool |

### `gridspace`

Custom 3D design tools.

| Service | Purpose |
|---------|---------|
| Gridspace apps | 3D modeling and design tools |
| Kiri:moto | Parametric jewelry design |
| Mesh Tool | Mesh processing |
| Void:Form | 3D form generation |

### `micro`

BeckCloud Micro — 13 stateless micro-services exposed to the internet under `*.tools.becklab.cloud`.

| Service | Purpose |
|---------|----------|
| auth-micro | JWT/API key validation (Go, <5MB) |
| hash-service | Hash generation (SHA-256, MD5, etc.) |
| short-service | URL shortener |
| base64-service | Base64 encode/decode |
| markdown-service | Markdown/Pandoc conversion |
| resize-service | Image resize (libvips) |
| cron-service | Scheduled jobs |
| dns-service | DNS monitoring |
| webhook-service | Webhook relay |
| fmt-service | YAML/JSON formatting |
| qr-service | QR code generation |
| editor-service | Image editor (browser-facing) |
| beckflow-service | Workflow orchestration (browser-facing) |

**Security:** Rate limiting per service, CORS for browser services, auth middleware for paid tier, IP whitelist for admin, request size limits (50MB image / 10MB default), shared 10 GiB PVC, 4 CPU / 2 GiB resource quota.

---

### `rbac`

Cluster-level RBAC roles and bindings (not a pod namespace, just policy definitions).

### `sources`

HelmRepository source definitions for Flux (not a pod namespace).

### `configs`

Cluster-wide configuration (StorageClasses, CoreDNS) — not a pod namespace.

### `controllers`

Infrastructure controllers (Cilium HelmRelease, NVIDIA device plugin) — not a pod namespace.

### `csi-snapshotter`

VolumeSnapshotClass definitions — not a pod namespace.

---

## Flux Apps Namespace (`flux/apps/`)

User-facing apps managed separately from infrastructure with a 5-minute sync interval.

| Service | Purpose |
|---------|---------|
| user-invite | User provisioning/invitation app |
| toolbox | Build containers (Kaniko) |
