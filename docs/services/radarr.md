# radarr

**Purpose:** Radarr — automated movie manager (downloads, organizes, and monitors films).

**What it does:** Radarr watches for new releases, triggers qBittorrent to download matching movies, then places them into Jellyfin's library. Like Sonarr, it runs as a single container with persistent config.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/radarr:latest`, 1 replica |
| CPU | 200m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `radarr-config` (10 GiB, local-path). `media-movies` (45 TiB, LVM-backed). `media-downloads` (5 TiB, LVM-backed) |

**Ports:**
- Container `7878` (TCP) — Radarr HTTP API
- Service `7878` — ClusterIP
- IngressRoute: `radarr.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** Radarr and Sonarr share the same qBittorrent service for downloads. They are both essential for keeping Jellyfin up-to-date.
