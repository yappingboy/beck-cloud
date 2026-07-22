# directus

**Purpose:** Headless CMS API for BeckCloud content management.

**What it does:** Directus (v11) provides a REST/GraphQL API that serves as the primary data layer for the website and other frontend apps. It runs as a single container with its persistent data stored in PostgreSQL (managed by the same cluster). The service is exposed at `cms.becklab.cloud` with admin-only SSO protection via the `sso-admin-chain`.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained (none set) |
| RAM | 512Mi limit (no request set) |
| PVCs | `directus-data` (2 GiB, local-path) for app state and schema |

**Ports:**
- `8055` — Directus API (HTTP). Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Route: `cms.becklab.cloud` → Service `directus`
- SSO chain: `sso-admin-chain` (oauth2-redirect → keycloak-forward-auth)

**Environment variables (Helm defaults):**
- Database URL points to the internal PostgreSQL instance.
- Authentication secret referenced via `DIRECTUS_SECRET`.
- CORS and host headers configured for external access.

**Notes:** Directus is the backend for most public-facing pages; all API calls are authenticated through Keycloak, ensuring only authorized admins can modify content.