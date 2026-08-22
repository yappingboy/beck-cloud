# directus

**Purpose:** Headless CMS API for BeckCloud content management.

**What it does:** Directus (`directus/directus:11`) provides a REST/GraphQL API that serves as the data layer for the website and other frontend apps. It runs as a single container with its database (SQLite) stored on the `directus-data` PVC. The service is exposed at `cms.becklab.cloud` with admin-only SSO protection via the `sso-admin-chain`.

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
- SSO chain: `sso-admin-chain` (oauth2-redirect-admin → keycloak-forwardauth-admin → admin-role-check)

**Environment variables:**
- `KEY` / `SECRET` (static values in the deployment) for signing and hashing.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the bootstrap admin account.
- `DB_CLIENT` (`sqlite3`), `DB_FILENAME` (`/directus/database/data.db` on the PVC), `DB_AUTO_MIGRATE` (`true`).
- `PUBLIC_URL` / `SERVER_DOMAIN` set to `https://cms.becklab.cloud`.
- CORS enabled for `https://silex.becklab.cloud` via env and the `directus-cors` Traefik middleware.

**Notes:** Directus is the backend for most public-facing pages. All API calls are authenticated through Keycloak, ensuring only authorized admins can modify content.