# traefik/traefik-app

**Purpose:** Traefik ingress controller

**What it does:** Traefik v3.4.3 HelmRelease, middleware configuration, and dashboard ingress/certificate.

**Services:**
- `helmrelease` — Traefik HelmRelease
- `middlewares` — Traefik middlewares (auth, rate-limit, etc.)
- `dashboard-ingress` — Traefik dashboard IngressRoute
- `dashboard-certificate` — TLS certificate for dashboard
