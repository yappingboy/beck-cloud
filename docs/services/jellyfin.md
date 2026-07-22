# jellyfin

**Purpose:** Jellyfin media server — streaming, transcoding, and library management for all BeckCloud media.

**What it does:** Jellyfin (self-hosted) serves movies, shows, anime, and other media to clients via its web UI and API. It handles on-the-fly transcoding, subtitle rendering, and remote access. All media files live in LVM-backed storage (not in Kubernetes PVCs), but Jellyfin's configuration and database are persisted here.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 1 request / 8 limit |
| RAM | 2Gi request / 8Gi limit |
| PVCs | `jellyfin-config` (20 GiB, local-path) for app config and database |

**Ports:**
- `8096` — Jellyfin HTTP (web UI + API). Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Route(s): Defined in the Helm chart; typically serves under `media.jellyfin.becklab.cloud` or similar. No SSO required for media consumption.

**Environment variables (Helm defaults):**
- `JELLYFIN_PUBLICURL` — external URL for remote clients.
- `JELLYFIN_CONFIG_ROOT` — points to the PVC mount.
- Transcoding and network settings as per the chart.

**Notes:** Jellyfin is the core media player; all other media services (Sonarr, Radarr, etc.) feed it with metadata.