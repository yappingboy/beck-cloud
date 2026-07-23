# logout-page

**Purpose:** Static Nginx page served as the post-logout redirect target for oauth2-proxy.

**What it does:** After a user logs out via oauth2-proxy (which clears the session cookie and invalidates the Redis session), they are redirected to this simple Nginx instance. The page displays a "Logged Out" message with a link back to the home page (`https://home.becklab.cloud`). The HTML content is stored in the `logout-page-html` ConfigMap and mounted at `/usr/share/nginx/html`.

The ConfigMap contains two pages:
- `index.html` — auto-redirect (meta refresh) to `https://home.becklab.cloud`.
- `logout.html` — styled "Logged Out" confirmation page with a manual link to home.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Not constrained |
| RAM | 64Mi limit |
| PVCs | None (ephemeral, ConfigMap-mounted) |

**Ports:**
- `80` — HTTP (internal, routed via Traefik).

**Volumes:**
- `logout-page-html` (ConfigMap) → `/usr/share/nginx/html`

**Notes:** Deployed via Flux CD Kustomize (`kustomize.toolkit.fluxcd.io/name=infrastructure`). Uses the lightweight `nginx:alpine` image. No environment variables required.
