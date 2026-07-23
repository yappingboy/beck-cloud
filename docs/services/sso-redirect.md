# sso-redirect

**Purpose:** Nginx landing page that routes SSO redirect traffic to the appropriate oauth2-proxy instance.

**What it does:** When Traefik's middleware chains detect an unauthenticated request, they redirect the user to `sso-redirect`, which serves a JavaScript-based redirect page. The page determines which oauth2-proxy to send the user to based on the URL path:
- `/admin/*` → redirects to `https://oauth2.becklab.cloud/oauth2/start?rd=<original URL>` (admin tier).
- `/media/*` → redirects to `https://oauth2-media.becklab.cloud/oauth2/start?rd=<original URL>` (media tier).

Both redirect pages display "Signing in, please wait..." while the browser performs the redirect. The HTML and Nginx configuration are stored in the `sso-redirect-html` ConfigMap.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 5m request / 50m limit |
| RAM | 16Mi request / 32Mi limit |
| PVCs | None (ephemeral, ConfigMap-mounted) |

**Ports:**
- `80` — HTTP (internal, routed via Traefik).

**Volumes:**
- `sso-redirect-html` (ConfigMap) mounted at:
  - `/etc/nginx/conf.d/default.conf` (Nginx config)
  - `/usr/share/nginx/html/admin/index.html` (admin redirect page)
  - `/usr/share/nginx/html/media/index.html` (media redirect page)

**Notes:** Deployed via Flux CD Kustomize (`kustomize.toolkit.fluxcd.io/name=infrastructure`). Uses `nginx:1.27-alpine`. Acts as the entry point for the SSO login flow — users hit this page when their session expires or they access a protected route without authentication.
