# sabnzbd

**Purpose:** SABnzbd — NZB download client (alternative to NZBGet).

**What it does:** SABnzbd fetches and processes NZB files, placing them into the shared media catalog. It runs alongside NZBGet, providing redundancy and different configuration options. The service exposes an HTTP API for management.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/sabnzbd:latest`, 1 replica |
| CPU | 800m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `sabnzbd-config` (5 GiB, local-path) for settings and queue. `media-downloads` (5 TiB, LVM-backed) |

**Ports:**
- Container `8080` (TCP) — SABnzbd HTTP API
- Service `8080` — ClusterIP
- IngressRoute: `sabnzbd.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** Both NZBGet and SABnzbd write to the same storage pool. Jellyfin's library scanning picks up files from either source.