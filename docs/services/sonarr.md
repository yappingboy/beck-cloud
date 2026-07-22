# sonarr

**Purpose:** Sonarr — automated TV show manager (downloads, organizes, and monitors series).

**What it does:** Sonarr watches RSS feeds for new episodes of series, triggers qBittorrent/Gluetun to download them, then renames and moves the files into Jellyfin's library. It runs as a single container with its configuration persisted locally.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `sonarr-config` (10 GiB, local-path) for database and settings |

**Ports:**
- `8989` — Sonarr HTTP API. Exposed by Traefik (internal use only).

**Middleware / Ingress:**
- No public hostname; accessed internally via the service name.

**Environment variables (Helm defaults):**
- `SONARR_CONFIG_DIR` — points to the PVC.
- `RSS_ADDRESSES` — list of feed URLs.
- Other defaults for language, quality profiles, etc.

**Notes:** Sonarr is tightly coupled with Jellyfin and qBittorrent; it doesn't serve media directly.