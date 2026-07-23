# oauth2-proxy

**Purpose:** OAuth2 reverse proxy (v7.6.0) for SSO authentication of admin-tier services.

**What it does:** oauth2-proxy intercepts incoming requests and validates user sessions against Keycloak via OIDC. It runs as a Helm-deployed Deployment in the `identity` namespace with `--set-xauthrequest=true`, enabling Traefik's `forwardAuth` middleware to delegate auth decisions to it. Only users in the `/admins` Keycloak group are allowed through. Sessions are stored in Redis (`redis` StatefulSet) rather than cookies alone, enabling session sharing across replicas. The proxy listens on port 4180 (HTTP) and 44180 (Prometheus metrics).

The main instance is reached via `https://oauth2.becklab.cloud` and is used by the **sso-admin-chain** middleware (`oauth2-redirect` → `keycloak-forward-auth`) for `/admin` endpoints. Cookie name: `_oauth2_admin`.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Not constrained (Helm defaults) |
| RAM | Not constrained (Helm defaults) |
| PVCs | None (sessions stored in Redis) |

**Ports:**
- `4180` — HTTP (internal, used by Traefik forwardAuth).
- `44180` — Prometheus metrics.
- `4443` — HTTPS (configured but not exposed as a service port).

**Key configuration:**
- `provider = "keycloak-oidc"`, `oidc_issuer_url = "https://keycloak.becklab.cloud/realms/homelab"`
- `allowed_groups = ["/admins"]`
- `redirect_url = "https://oauth2.becklab.cloud/oauth2/callback"`
- `session_store_type = "redis"`
- `cookie_domains = [".becklab.cloud"]`, `cookie_samesite = "lax"`
- `upstreams = ["static://202"]` — returns 202 Accepted on auth success (X-Auth-Request-User/Email headers carry identity).

**Key environment variables:**
- `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET` — from `oauth2-proxy-secrets` secret (Keycloak client credentials).
- `OAUTH2_PROXY_COOKIE_SECRET` — from `oauth2-proxy-secrets` (cookie encryption key).
- `OAUTH2_PROXY_REDIS_CONNECTION_URL` — from `redis-secrets` (session store connection).

**Notes:** Managed by Helm (`helm.sh/chart=oauth2-proxy-7.6.0`) and deployed via Flux CD. See `oauth2-proxy-media` for the media-tier counterpart.
