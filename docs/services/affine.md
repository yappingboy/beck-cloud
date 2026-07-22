# affine

**Purpose:** Collaborative wiki platform powering the BeckCloud knowledge base.

**What it does:** Affine (v0.x) runs as a headless web app that stores content in PostgreSQL and caches in Redis. The service is exposed at `affine.becklab.cloud` with admin-only access via the SSO admin chain. It provides real-time editing, markdown rendering, and acts as the central documentation hub for the cluster.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m request / 1 limit |
| RAM | 512Mi request / 1Gi limit |
| PVCs | `affine-config` (1 GiB, local-path) for app config, `affine-postgres-data` (10 GiB) for PostgreSQL, `affine-storage` (20 GiB) for user content |

**Ports:**
- `3010` — Affine HTTP (exposed via Traefik with TLS).

**Middleware / Ingress:**
- Route: `affine.becklab.cloud` → Service `affine-server`
- SSO chain: `sso-admin-chain` (oauth2-redirect → keycloak-forward-auth)

**Key environment variables (set via Helm):**
- Database: `AFFINE_DATABASE_URL` pointing to the internal PostgreSQL (same namespace).
- Cache: `AFFINE_REDIS_URL` for session and real-time sync.
- Other defaults: host headers, CORS, etc.

**Notes:** Affine is one of the few services that directly serves end users; all requests are authenticated through Keycloak via the admin SSO chain.