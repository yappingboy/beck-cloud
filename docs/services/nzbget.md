# nzbget

**Purpose:** NZBGet — NZB and torrent download client.

**What it does:** NZBGet fetches NZB files (via NZB indexing services) and torrents, then stores them in the shared media volume for Jellyfin/Radarr/Sonarr to process. It runs as a container with moderate resources and persistent config.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/nzbget:latest`, 1 replica |
| CPU | 800m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `nzbget-config` (5 GiB, local-path) for settings and download queue. `media-downloads` (5 TiB, LVM-backed) |

**Ports:**
- Container `6789` (TCP) — NZBGet HTTP API
- Service `6789` — ClusterIP
- IngressRoute: `nzbget.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** NZBGet is one of two download engines in the stack (the other being SABnzbd). Both feed into the same storage pool.