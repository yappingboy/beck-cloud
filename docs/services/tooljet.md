# tooljet

**Purpose:** ToolJet — low-code application builder for internal admin tooling.

**What it does:** ToolJet lets admins build and publish internal dashboards and tools without writing frontend code. It exposes an HTTP UI and a PostgREST layer. The service runs in the `webapps` namespace with its own PostgreSQL backend.

**Resources:**
| Type | Details |
|------|---------|
| CPU (app) | 500m request / 2 limit |
| RAM (app) | 1Gi request / 3Gi limit |
| CPU (postgres) | 200m request / 1 limit |
| RAM (postgres) | 256Mi request / 1Gi limit |
| PVCs | `tooljet-postgres-data` (20 GiB), `tooljet-storage` (10 GiB) |

**Images:**
- App: `tooljet/tooljet:ee-lts-latest`
- Database: `postgres:16-alpine`

**Ports:**
- `3000` — ToolJet HTTP UI. Exposed by Traefik with TLS.
- `5432` — PostgreSQL (internal only, no IngressRoute).

**Middleware / Ingress:**
- Route: `tooljet.becklab.cloud` → Service port 3000
- SSO: `sso-admin-chain` (Keycloak `/admins` group)

**Notes:** ToolJet runs its own migrations on first boot. The PostgREST service runs on port 5432 internally. The app container reads `localhost:3001` for the PostgREST sidecar.
