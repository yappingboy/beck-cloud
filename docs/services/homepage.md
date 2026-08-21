# homepage

**Purpose:** Dashboard landing page for BeckCloud administrators.

**What it does:** Homepage (`ghcr.io/gethomepage/homepage:latest`, HelmRelease in `webapps`) provides quick links to cluster services and health widgets. It runs with cluster RBAC enabled so the Kubernetes widget can query the API. It has no persistent storage. External access is at `home.becklab.cloud` via Traefik with TLS.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained |
| RAM | Unconstrained |
| PVCs | None (ephemeral) |

**Ports:**
- `3000` — HTTP (served at `home.becklab.cloud` via Traefik with TLS).

**Middleware / Ingress:**
- Route: `home.becklab.cloud` → Homepage service (port 3000)
- SSO chain: `identity-sso-media-chain` (via ingress annotation `identity-sso-media-chain@kubernetescrd`)
- Certificate: `homepage-tls` (cert-manager, letsencrypt-prod)

**Environment variables:** `HOMEPAGE_ALLOWED_HOSTS` set to `home.becklab.cloud`.

**Notes:** The homepage links to most cluster services. Service status widgets probe the internal cluster service URLs so they bypass SSO. Click targets use the public URLs.