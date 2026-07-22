# traefik

**Purpose:** Ingress controller and reverse proxy for the entire BeckCloud.

**What it does:** Traefik (v3.4.3) terminates TLS, routes incoming traffic to internal services based on hostname and path rules, and applies global middleware chains. It exposes HTTP/HTTPS entry points and proxies requests to the appropriate namespace services. All external IngressRoutes are defined in this namespace; Traefik uses Kubernetes-native dynamic configuration (CRDs) so no static YAML is needed.

**Resources:**
| Type | Details |
|------|---------|
| CPU | None (unconstrained) |
| RAM | None (unconstrained) |

**Ports:**
- `80` — HTTP (NodePort, redirects to HTTPS when TLS cert exists)
- `443` — HTTPS (TLS termination)

**Middleware applied globally:**
- **crowdsec-bouncer:** Blocks IPs flagged by Crowdsec before traffic reaches any service.
- **sso-admin-chain / sso-media-chain:** OAuth2-proxy middleware for protected endpoints (see the `identity` and `media` namespace docs).

**IngressRoutes exposed:**
- `traefik-dashboard-https` — Traefik web UI (`traefik.becklab.cloud`).

**Environment variables:** None beyond defaults; all configuration is declarative via CRDs.

**Notes:** Traefik runs as a Deployment without resource limits to ensure it remains responsive under load. The dashboard is the only publicly accessible service in this namespace.