# bazarr

**Purpose:** Bazarr — automated subtitle manager for Jellyfin.

**What it does:** Bazarr monitors Sonarr/Radarr download events, fetches subtitles from providers (OpenSubtitles.), and places them into the appropriate media folders so Jellyfin can serve them. It runs as a lightweight container with minimal footprint.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/bazarr:latest`, 1 replica |
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `bazarr-config` (5 GiB, local-path) for provider settings and cache. `media-movies` and `media-shows` (45 TiB each, LVM-backed) |

**Ports:**
- Container `6767` (TCP) — Bazarr HTTP API
- Service `6767` — ClusterIP
- IngressRoute: `bazarr.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** Bazarr is tightly coupled with Sonarr/Radarr. It does not operate in isolation.