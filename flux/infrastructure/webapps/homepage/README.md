# webapps/homepage (Dashy)

**Purpose:** Dashboard and aggregation layer

**What it does:** Dashy dashboard (lissy93/dashy) with full service catalog, status checking, and widgets. Replaced gethomepage/homepage on 2026-08-29.

**Services:**
- `dashy` — Dashy Deployment with ConfigMap for conf.yml
- `dashy` Service (ClusterIP, port 8080)
- `dashy` IngressRoute → home.becklab.cloud with sso-admin-chain SSO

**Config:** `config/conf.yml` — full service definitions with status check URLs and API keys.
