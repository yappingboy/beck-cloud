# landing-page

**Purpose:** External-facing entry point for the BeckCloud public website.

**What it does:** A lightweight static site serving the public landing page (branding, links to services, and basic info). It runs as a small container with no persistent storage; all content is baked into the image. The service listens on port 80 and is exposed via Traefik — it likely has an IngressRoute that maps external hostname(s) to this service (exact hostnames are defined in the Helm values for the webapps stack).

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m limit (no request set) |
| RAM | 128Mi limit (no request set) |
| PVCs | None (ephemeral) |

**Ports:**
- `80` — HTTP. Exposed with TLS via Traefik's default HTTPS entry point.

**Middleware / Ingress:**
- Route(s): Defined in the Helm chart for the landing page; typically uses a wildcard or specific subdomain (e.g., `becklab.cloud`).
- No SSO required — this is the public-facing UI.

**Environment variables:** None beyond defaults; all content is static.

**Notes:** The landing page is the only public web service that does not require authentication. If you need to modify it, edit the Helm values or the image directly.