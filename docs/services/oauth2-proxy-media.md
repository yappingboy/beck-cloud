# oauth2-proxy-media

**Purpose:** OAuth2 reverse proxy (v7.6.0) for SSO authentication of media-tier services.

**What it does:** Identical in architecture to `oauth2-proxy`, but configured for the media stack. It intercepts requests to media services (Jellyfin, Radarr, Sonarr, etc.) and validates sessions against Keycloak via OIDC. Both `/admins` and `/media` Keycloak groups are allowed through. Sessions are stored in the shared Redis instance.

The media instance is reached via `https://oauth2-media.becklab.cloud` and is used by the **sso-media-chain** middleware for `/media` endpoints. Cookie name: `_oauth2_media`.

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
- `allowed_groups = ["/admins", "/media"]`
- `redirect_url = "https://oauth2-media.becklab.cloud/oauth2/callback"`
- `session_store_type = "redis"`
- `cookie_domains = [".becklab.cloud"]`, `cookie_samesite = "lax"`
- `upstreams = ["static://202"]` — returns 202 Accepted on auth success.

**Key environment variables:**
- `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET` — from `oauth2-proxy-secrets` secret (separate Keycloak client from the admin instance).
- `OAUTH2_PROXY_COOKIE_SECRET` — from `oauth2-proxy-secrets` (cookie encryption key).
- `OAUTH2_PROXY_REDIS_CONNECTION_URL` — from `redis-secrets` (session store connection).

**Notes:** Managed by Helm (`helm.sh/chart=oauth2-proxy-7.6.0`) and deployed via Flux CD. Shares the same Redis backend as the admin oauth2-proxy instance.
