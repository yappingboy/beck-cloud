# homebox

**Purpose:** Homebox — inventory and asset tracker for BeckCloud.

**What it does:** Homebox serves as the central database of media assets, recording titles, file hashes, sizes, and provenance. It powers Jellyseerr (movie request system) by providing metadata to match user requests with existing content. The service runs as a lightweight container with minimal resource usage.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 500m limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `homebox-config` (10 GiB, local-path) for PostgreSQL data and uploads |

**Ports:**
- Default Homebox port is 7745 (HTTP). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname configured.

**Environment variables (Helm defaults):**
- `HOMEBOX_DATABASE_URL` — points to the internal PostgreSQL instance (also in this namespace).
- `HOMEBOX_UPLOAD_PATH` — mounted from PVC.
- Other defaults for UI theme, etc.

**Notes:** Homebox is tightly coupled with Jellyseerr; together they form the "request" workflow for movies and shows.