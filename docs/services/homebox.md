# homebox

**Purpose:** Homebox — inventory and asset tracker for BeckCloud.

**What it does:** Homebox serves as the central database of media assets, recording titles, file hashes, sizes, and provenance. It powers Jellyseerr (movie request system) by providing metadata to match user requests with existing content. The service runs as a lightweight container with minimal resource usage.

**Resources:**
| Type | Details |
|------|---------|
| Image | `ghcr.io/sysadminsmedia/homebox:latest`, 1 replica |
| CPU | 50m request / 500m limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `homebox-config` (10 GiB, local-path) for data and uploads, mounted at `/app/data` |

**Ports:**
- Container `7745` (TCP) — Homebox HTTP
- Service `7745` — ClusterIP
- IngressRoute: `homebox.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`
- `HBOX_AUTH_API_KEY_PEPPER` — auth key pepper

**Notes:** Homebox is tightly coupled with Jellyseerr. Together they form the "request" workflow for movies and shows.