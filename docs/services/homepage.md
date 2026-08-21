# homepage

**Purpose:** Dashboard landing page for BeckCloud administrators.

**What it does:** A static HTML/JS dashboard providing quick links to core services (Keycloak, Traefik, Wazuh) and cluster health widgets. It runs as an ephemeral container with no persistent storage. All content is baked into the image. It is accessible via the internal network and proxied by Traefik, with no dedicated IngressRoute. This makes it reachable only from within the cluster or via direct service IP.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained |
| RAM | Unconstrained |
| PVCs | None (ephemeral) |

**Ports:**
- `3000` — HTTP (internal only).

**Middleware / Ingress:**
- Exposed by Traefik as an internal service. No external hostname.

**Environment variables:** None beyond defaults.

**Notes:** The homepage is primarily for local admin use. If external access is ever needed, an IngressRoute can be added pointing to port 3000.