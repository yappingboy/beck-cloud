# landing-page

**Purpose:** External-facing entry point for the BeckCloud public website.

**What it does:** A lightweight static site serving the public landing page (branding, service links, basic info). It runs as a small container with no persistent storage. All content is baked into the image. It listens on port 80 and is exposed via Traefik. An IngressRoute maps external hostnames to this service, with exact hostnames defined in the Helm values.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 200m limit (no request set) |
| RAM | 128Mi limit (no request set) |
| PVCs | None (ephemeral) |

**Ports:**
- `80` — HTTP. Exposed with TLS via Traefik's default HTTPS entry point.

**Middleware / Ingress:**
- Route(s): Defined in the Helm chart for the landing page. Typically uses a wildcard or specific subdomain (for example, `becklab.cloud`).
- No SSO required — this is the public-facing UI.

**Environment variables:** None beyond defaults. All content is static.

**Notes:** The landing page is the only public web service that does not require authentication. If you need to modify it, edit the Helm values or the image directly.