# identity/oauth2

**Purpose:** IngressRoute for oauth2.becklab.cloud (oauth2-proxy admin redirect endpoint)

**What it does:** Routes oauth2.becklab.cloud to the oauth2-proxy admin service on port 80 with TLS. This is the redirect/callback endpoint used by the SSO redirect page.

**Services:**
- `oauth2-ingress` — IngressRoute
