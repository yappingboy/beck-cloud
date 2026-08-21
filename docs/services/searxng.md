# searxng

**Purpose:** SearXNG — private metasearch engine.

**What it does:** SearXNG runs a private metasearch engine for the cluster. It aggregates results from multiple upstream search engines. The service runs in the `webapps` namespace with a Valkey cache backend.

**Resources:**
| Type | Details |
|------|---------|
| CPU (app) | 100m request / 500m limit |
| RAM (app) | 128Mi request / 512Mi limit |
| CPU (valkey) | 10m request / 100m limit |
| RAM (valkey) | 32Mi request / 128Mi limit |
| PVCs | None. Cache is in-memory. |

**Images:**
- App: `docker.io/searxng/searxng:latest`
- Cache: `docker.io/valkey/valkey:9-alpine`

**Ports:**
- `8080` — SearXNG HTTP UI. Exposed by Traefik with TLS.
- `6379` — Valkey cache (internal only, no IngressRoute).

**Middleware / Ingress:**
- Route: `searx.becklab.cloud` → Service port 8080
- SSO: `sso-admin-chain` (Keycloak `/admins` group)
- ACME challenge route: `/.well-known/acme-challenge/` (no SSO)

**Notes:** SearXNG is a private instance. Results do not persist. The Valkey sidecar holds search cache and rate-limit state.
