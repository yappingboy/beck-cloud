# keycloak

**Purpose:** Central OpenID/OAuth2 identity provider for the BeckCloud SSO system. All authenticated services (admin console, webapps, media stack) obtain tokens here and federate user data via LLDAP.

**What it does:** Keycloak (v26.0) runs as a Docker image backed by an internal PostgreSQL instance (`keycloak-postgresql`) for persistent realm data. It provides login, token issuance, and OAuth2/OIDC flows. The Keycloak service is not directly exposed to the internet; access is mediated by Traefik through middleware chains:
- **Admin chain:** `sso-admin-chain` (oauth2-redirect → keycloak-forward-auth) for /admin endpoints.
- **Media chain:** `sso-media-chain` (same pattern, separate oauth2-proxy) for media-stack services.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m request / 2 limit |
| RAM | 1Gi request / 4Gi limit |
| PVCs | `data-keycloak-postgresql-0` (10 GiB, local-path), `data-redis-0` (1 GiB, local-path) for session cache |

**Ports:**
- `8080` — Keycloak internal HTTP (exposed via Traefik with TLS).

**Key environment variables:**
- `KC_DB=postgres`, `KC_DB_URL=jdbc:postgresql://keycloak-postgresql:5432/keycloak`, `KC_DB_USERNAME=keycloak`, `KC_DB_PASSWORD=***`
- `KC_HOSTNAME=false`, `KC_HOSTNAME_STRICT=false`, `KC_HTTP_ENABLED=true`, `KC_PROXY_HEADERS=xforwarded`, `KC_HEALTH_ENABLED=true`
- Admin bootstrap: `KC_BOOTSTRAP_ADMIN_USERNAME=admin`, `KC_BOOTSTRAP_ADMIN_PASSWORD=*** (via helm secret)`

**Notes:** The admin account is created at install time; regular users are synced from LLDAP groups.