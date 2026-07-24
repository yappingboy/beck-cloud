# BeckCloud Permission Matrix

> Current and target state for all services. Updated 2026-07-24.

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔒 | Authenticated only (SSO) |
| 🔓 | Public (no auth) |
| 👑 | Admin only |
| 📊 | Monitor role |
| ⬇️ | Download role |
| 🎬 | Media view role |
| 🛠️ | Dev role |
| 📝 | CMS role |
| 👤 | Any authenticated user |
| 🔄 | Multiple acceptable roles |

## Current State (Group-Based)

All services use a simple binary check: "Is user in /admins or /media group?"

| Service | URL | Current Access | Group Required |
|---------|-----|----------------|----------------|
| Grafana | grafana.becklab.cloud | 🔒 | /admins |
| Prometheus | prometheus.becklab.cloud | 🔒 | /admins |
| Alertmanager | alertmanager.becklab.cloud | 🔒 | /admins |
| Hubble | hubble.becklab.cloud | 🔒 | /admins |
| OpenNebula | one.becklab.cloud | 🔒 | /admins |
| Keycloak | keycloak.becklab.cloud | 🔒 (self-auth) | — |
| Bitwarden | bw.becklab.cloud | 🔓 (self-auth) | — |
| Directus | cms.becklab.cloud | 🔒 (self-auth) | — |
| Affine | affine.becklab.cloud | 🔒 | /admins |
| Silex | silex.becklab.cloud | 🔒 | /admins |
| Traefik | traefik.becklab.cloud | 🔒 | /admins |
| Jellyfin | internal only | 🔒 | /media |
| Jellyseerr | internal only | 🔒 | /media |
| Radarr | internal only | 🔒 | /media |
| Sonarr | internal only | 🔒 | /media |
| Prowlarr | internal only | 🔒 | /media |
| Bazarr | internal only | 🔒 | /media |
| SABnzbd | internal only | 🔒 | /admins |
| NZBGet | internal only | 🔒 | /admins |
| qBittorrent | internal only | 🔒 | /admins |
| Tdarr | internal only | 🔒 | /media |
| Homebox | internal only | 🔒 | /media |
| Manyfold | internal only | 🔒 | /admins |
| Auth Service | internal only | 🔒 | /admins |
| BeckFlow | internal only | 🔒 | /admins |
| Cron Jobs | internal only | 🔒 | /admins |
| DNS Monitor | internal only | 🔒 | /admins |
| Image Editor | internal only | 🔒 | /admins |
| Swiparr | internal only | 🔒 | /media |
| Homepage | internal only | 🔒 | /admins |
| Budibase | internal only | 🔒 | /admins |
| Kiri:Moto | kirimoto.becklab.cloud | 🔓 | — |
| Mesh:Tool | meshtool.becklab.cloud | 🔓 | — |
| Void:Form | voidform.becklab.cloud | 🔓 | — |
| BumpMesh | bumptools.becklab.cloud | 🔓 | — |
| URL Shortener | short.becklab.cloud | 🔓 | — |
| Webhook Relay | webhook.becklab.cloud | 🔓 | — |
| YAML/JSON Tool | yaml.becklab.cloud | 🔓 | — |
| Base64 | base64.becklab.cloud | 🔓 | — |
| Hash | hash.becklab.cloud | 🔓 | — |
| QR Code | qr.becklab.cloud | 🔓 | — |
| LLDAP | internal only | 🔓 | — |

## Target State (Role-Based RBAC)

Each service requires specific roles. Admins get all roles automatically.

| Service | URL | Required Role(s) | Public? | Notes |
|---------|-----|-----------------|---------|-------|
| **Admin Services** | | | | |
| Grafana | grafana.becklab.cloud | 📊 monitor | — | Monitoring dashboard |
| Prometheus | prometheus.becklab.cloud | 📊 monitor | — | Metrics |
| Alertmanager | alertmanager.becklab.cloud | 📊 monitor | — | Alerts |
| Hubble | hubble.becklab.cloud | 📊 monitor | — | Network observability |
| Keycloak Admin | keycloak.becklab.cloud | 👑 admin | — | Identity management |
| OpenNebula | one.becklab.cloud | 👑 admin | — | Hypervisor control |
| Traefik | traefik.becklab.cloud | 👑 admin | — | Ingress dashboard |
| Silex | silex.becklab.cloud | 👑 admin | — | Design tool |
| Directus | cms.becklab.cloud | 📝 cms | — | CMS admin |
| Affine | affine.becklab.cloud | 📝 cms or 👤 user | — | Wiki |
| Bitwarden | bw.becklab.cloud | 🔓 | ✓ | No SSO (self-auth) |
| **Media Services** | | | | |
| Jellyfin | media internal | 🎬 media-view | — | Streaming |
| Jellyseerr | media internal | 🎬 media-view | — | Request management |
| Radarr | media internal | 🎬 media-view | — | Movies |
| Sonarr | media internal | 🎬 media-view | — | TV Shows |
| Prowlarr | media internal | 🎬 media-view | — | Indexer |
| Bazarr | media internal | 🎬 media-view | — | Subtitles |
| Tdarr | media internal | 🛠️ media-manage | — | Transcoding |
| Swiparr | media internal | 🎬 media-view | — | Anime |
| Homebox | media internal | 🎬 media-view | — | Inventory |
| Manyfold | media internal | 📝 cms | — | Asset management |
| **Download Services** | | | | |
| qBittorrent | download internal | 🔄 ⬇️ download or 🎬 media-view | — | Torrent client |
| SABnzbd | download internal | ⬇️ download | — | NZB downloader |
| NZBGet | download internal | ⬇️ download | — | NZB downloader |
| **Dev Services** | | | | |
| Auth Service | dev internal | 🛠️ dev | — | Authentication |
| BeckFlow | dev internal | 🛠️ dev | — | Workflow |
| Cron Jobs | dev internal | 🛠️ dev | — | Cron management |
| DNS Monitor | dev internal | 🛠️ dev | — | DNS monitoring |
| Image Editor | dev internal | 🛠️ dev | — | Image editing |
| **Public Services** | | | | |
| Kiri:Moto | 🔓 kirimoto.becklab.cloud | — | ✓ | AI image generation |
| Mesh:Tool | 🔓 meshtool.becklab.cloud | — | ✓ | 3D mesh tool |
| Void:Form | 🔓 voidform.becklab.cloud | — | ✓ | Form builder |
| BumpMesh | 🔓 bumptools.becklab.cloud | — | ✓ | 3D tool |
| URL Shortener | 🔓 short.becklab.cloud | — | ✓ | URL shortening |
| Webhook Relay | 🔓 webhook.becklab.cloud | — | ✓ | Webhook endpoint |
| YAML/JSON Tool | 🔓 yaml.becklab.cloud | — | ✓ | Data conversion |
| Base64 | 🔓 base64.becklab.cloud | — | ✓ | Encoding |
| Hash | 🔓 hash.becklab.cloud | — | ✓ | Hashing |
| QR Code | 🔓 qr.becklab.cloud | — | ✓ | QR generation |
| LLDAP | 🔓 internal | — | ✓ | LDAP server |
| Homepage | internal | 👤 user | — | Dashboard |

## Role Definitions

| Role | Description | Default Recipients |
|------|-------------|-------------------|
| 👑 admin | Full admin access to all services | /admins group |
| 📊 monitor | Grafana, Prometheus, Alertmanager, Hubble | /monitoring group |
| ⬇️ download | qBittorrent, SABnzbd, NZBGet | /downloads group |
| 🎬 media-view | Jellyfin, Radarr, Sonarr, etc. | /media group |
| 🛠️ media-manage | Tdarr, Jellyseerr | — |
| 🛠️ dev | Auth Service, BeckFlow, Cron, DNS Monitor, Image Editor | /dev group |
| 📝 cms | Directus, Manyfold, Affine | /cms group |
| 👤 user | Any authenticated user (Homepage, etc.) | all authenticated |

## User → Role Assignment

| User | Group | Realm Role | Client Roles |
|------|-------|------------|--------------|
| yappingboy | /admins, /media | beckcloud.admin | admin, monitor, download, media-view, media-manage, dev, cms, user |
| aimeeyeghies | /admins | beckcloud.admin | admin, monitor, download, media-view, media-manage, dev, cms, user |
| fuzzol | /admins | beckcloud.admin | admin, monitor, download, media-view, media-manage, dev, cms, user |
| payduck | /admins | beckcloud.admin | admin, monitor, download, media-view, media-manage, dev, cms, user |

Additional users (assigned per-service):
- Specific users can get individual client roles without group membership
- Example: A user in /media gets media-view, but can also be given dev role for access to Auth Service

## Audit Events

| Event | When Triggered | Stored In |
|-------|---------------|-----------|
| role_assigned | Role granted to user | Keycloak events → Loki → Grafana |
| role_revoked | Role removed from user | Keycloak events → Loki → Grafana |
| login | Successful authentication | Keycloak events → Loki → Grafana |
| permission_denied | Role check fails | Role enforcer logs → Loki → Grafana |
| token_exchanged | Service-to-service auth | Keycloak events → Loki → Grafana |

---

*Draft 1.0 · 2026-07-24 · Nova*
*Next: Implementation phases in rbac-design.md*
