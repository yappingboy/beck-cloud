# homepage

**Purpose:** Dashboard landing page for BeckCloud administrators.

**What it does:** A simple static HTML/JS dashboard that provides quick links to core services (Keycloak, Traefik, Wazuh, etc.) and displays cluster health widgets. It runs as an ephemeral container with no persistent storage; all content is baked into the image. The service is accessible via the internal network and proxied by Traefik — it does not have a dedicated IngressRoute, so it's effectively only reachable from within the cluster (or via direct service IP if needed).

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained |
| RAM | Unconstrained |
| PVCs | None (ephemeral) |

**Ports:**
- `3000` — HTTP (internal only).

**Middleware / Ingress:**
- Exposed by Traefik as an internal service; no external hostname.

**Environment variables:** None beyond defaults.

**Notes:** The homepage is primarily for local admin use; if external access is ever needed, an IngressRoute can be added pointing to port 3000.