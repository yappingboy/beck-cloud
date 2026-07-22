# bazarr

**Purpose:** Bazarr — automated subtitle manager for Jellyfin.

**What it does:** Bazarr monitors Sonarr/Radarr download events, fetches subtitles from providers (OpenSubtitles, etc.), and places them into the appropriate media folders so Jellyfin can serve them. It runs as a lightweight container with minimal footprint.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `bazarr-config` (5 GiB, local-path) for provider settings and cache |

**Ports:**
- Default Bazarr port is 6767 (HTTP API). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname.

**Environment variables (Helm defaults):**
- `BAZARR_CONFIG_DIR` — points to PVC.
- `MONITORING_ENABLED=true`.
- Subtitle provider credentials stored via secrets.

**Notes:** Bazarr is tightly coupled with Sonarr/Radarr; it doesn't work in isolation.