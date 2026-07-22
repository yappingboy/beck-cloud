# radarr

**Purpose:** Radarr — automated movie manager (downloads, organizes, and monitors films).

**What it does:** Radarr watches for new releases, triggers qBittorrent to download matching movies, then places them into Jellyfin's library. Like Sonarr, it runs as a single container with persistent config.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `radarr-config` (10 GiB, local-path) |

**Ports:**
- Default Radarr port is 7878 (HTTP API). Exposed by Traefik internally.

**Middleware / Ingress:**
- Internal-only; no public hostname configured.

**Environment variables (Helm defaults):**
- `RADARR_CONFIG_DIR` — points to the PVC.
- `MONITORING_ENABLED=true` — sends stats to Prometheus.
- Other defaults for language, quality, etc.

**Notes:** Radarr and Sonarr share the same qBittorrent service for downloads; they are both essential for keeping Jellyfin up-to-date.