# landing-page

**Purpose:** External-facing entry point for the BeckCloud public website.

**What it does:** The `landing-page` deployment runs `ghcr.io/yappingboy/becklab-landing:latest` (Django plus Apache) on container port 8080. It serves site content from the shared `silex-hosting` PVC mounted at `/hosting`. A companion `landing-page-gateway` deployment (same image, Node/Express on 8080) adds API and session endpoints. Both are exposed via Traefik IngressRoutes at `becklab.cloud` and `www.becklab.cloud` with TLS.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m limit (no request set), landing-page |
| RAM | 128Mi limit (no request set), landing-page |
| PVCs | `silex-hosting` for site content (shared with Silex), `landing-page-tickets` (1 GiB, local-path), `landing-page-audit-log`, `silex-root` (4 GiB, local-path) |

**Ports:**
- `8080` — container port for both deployments.
- `80` — Service port for `landing-page` and `landing-page-gateway` (targetPort 8080).

**Middleware / Ingress:**
- Route: `becklab.cloud` and `www.becklab.cloud` → Service `landing-page-gateway` (port 80).
- The host-level rule uses `sso-admin-chain` (identity namespace).
- Rules for `/admin`, `/profile`, `/api/` (regexp), and `/portal` carry no middleware.
- A second IngressRoute maps `becklab.cloud` → `landing-page-gateway:80` with no middleware.
- TLS secret: `landing-page-tls` (cert-manager, letsencrypt-prod).

**Environment variables:** `PYTHONDONTWRITEBYTECODE` and `PYTHONUNBUFFERED` (`1`), `HOSTING_DIR` (`/hosting`), `REDIS_URL` in the landing-page container.

**Notes:** The landing page serves the public website. The catch-all SSO rule and the unauthenticated path rules coexist in the same IngressRoute, so behavior depends on Traefik rule priority.
