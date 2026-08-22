# jellyfin

**Purpose:** Jellyfin media server — streaming, transcoding, and library management for all BeckCloud media.

**What it does:** Jellyfin serves movies, shows, anime, and other media to clients via its web UI and API. It handles on-the-fly transcoding, subtitle rendering, and remote access. Media files live on LVM-backed volumes, mounted through Kubernetes PVCs. The configuration and database persist on a local-path PVC.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/jellyfin:latest`, 1 replica |
| CPU | 1 request / 8 limit |
| RAM | 2Gi request / 8Gi limit |
| PVCs | `jellyfin-config` (20 GiB, local-path) for app config and database. `media-movies`, `media-shows`, `media-anime` (45 TiB each, LVM-backed) for media files |

**Ports:**
- Container `8096` (TCP) — Jellyfin HTTP (web UI + API)
- Service `8096` — ClusterIP
- IngressRoute: `jellyfin.becklab.cloud` over TLS (Let's Encrypt). No SSO middleware.

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** Jellyfin is the core media player. All other media services (Sonarr, Radarr.) feed it with metadata.
