# jellyseerr

**Purpose:** Jellyseerr — movie request and approval system.

**What it does:** Jellyseerr provides a public-facing UI where users can request movies/shows. It queries Homebox for availability, then notifies Radarr/Sonarr to download the content if it's not yet present. The service acts as the bridge between end-users and the automated media stack.

**Resources:**
| Type | Details |
|------|---------|
| Image | `seerr/seerr:latest`, 1 replica |
| CPU | 200m request / 1 limit |
| RAM | 512Mi request / 2Gi limit |
| PVCs | `jellyseerr-config` (10 GiB, local-path) for config, database, and uploads, mounted at `/app/config` |

**Ports:**
- Container `5055` (TCP) — Jellyseerr HTTP
- Service `5055` — ClusterIP
- IngressRoute: `requests.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-media-chain` (namespace `identity`)

**Environment variables:**
- `LOG_LEVEL=debug`

**Notes:** Jellyseerr depends on Homebox for metadata and on Radarr/Sonarr for fulfillment.