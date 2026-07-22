# jellyseerr

**Purpose:** Jellyseerr — movie request and approval system.

**What it does:** Jellyseerr provides a public-facing UI where users can request movies/shows. It queries Homebox for availability, then notifies Radarr/Sonarr to download the content if it's not yet present. The service acts as the bridge between end-users and the automated media stack.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m request / 1 limit |
| RAM | 512Mi request / 2Gi limit |
| PVCs | `jellyseerr-config` (10 GiB, local-path) for PostgreSQL and uploads |

**Ports:**
- Default Jellyseerr port is 5055 (HTTP). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname in current config.

**Environment variables (Helm defaults):**
- `JELLYSEERR_DATABASE_URL` — internal PostgreSQL.
- `JELLYFIN_BASE_URL` — points to Jellyfin service for media serving.
- Other defaults for theme, auth, etc.

**Notes:** Jellyseerr depends on Homebox for metadata and on Radarr/Sonarr for fulfillment.