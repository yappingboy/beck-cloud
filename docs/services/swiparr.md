# swiparr

**Purpose:** Swiparr — Plex metadata management for the media stack.

**What it does:** Swiparr manages Plex metadata for the media stack. It reads media libraries and applies consistent metadata and artwork. The service runs as a single replica in the `media` namespace.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 500m limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `swiparr-config` for SQLite data |

**Image:** `ghcr.io/m3sserstudi0s/swiparr:latest`

**Ports:**
- `4321` — HTTP UI. Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Route: `swiparr.becklab.cloud` → Service port 4321
- SSO: `sso-media-chain` (Keycloak `/media` group)

**Notes:** Swiparr connects to the Plex instance via the media SSO group. It uses a SQLite database stored on the local-path PVC. The service targets the media group, not the admin group.
