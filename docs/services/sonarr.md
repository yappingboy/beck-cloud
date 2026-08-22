# sonarr

**Purpose:** Sonarr — automated TV show manager (downloads, organizes, and monitors series).

**What it does:** Sonarr watches RSS feeds for new episodes. It triggers qBittorrent/Gluetun to download them, then renames and moves the files into Jellyfin's library. It runs as a single container with its configuration persisted locally.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/sonarr:latest`, 1 replica |
| CPU | 200m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `sonarr-config` (10 GiB, local-path) for database and settings. `media-shows` and `media-anime` (45 TiB each, LVM-backed). `media-downloads` (5 TiB, LVM-backed) |

**Ports:**
- Container `8989` (TCP) — Sonarr HTTP API
- Service `8989` — ClusterIP
- IngressRoute: `sonarr.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** Sonarr is tightly coupled with Jellyfin and qBittorrent. It does not serve media directly.
