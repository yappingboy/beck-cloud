# grafana

**Purpose:** Grafana — visualization and dashboard platform for BeckCloud monitoring.

**What it does:** Grafana connects to Prometheus (and other data sources) to render custom dashboards, alerts, and metrics queries. It serves as the primary UI for operations teams to monitor cluster health, resource usage, and application KPIs. The deployment runs as a single pod with persistent storage for dashboards and provisioning data.

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not explicitly set; uses Helm defaults (typically 1 CPU / 2 GiB) |
| PVCs | `kube-prometheus-stack-grafana` (10 GiB, local-path) for dashboards and provisioning |

**Ports:**
- `80` — Grafana web UI (HTTP). Exposed via Traefik with TLS at `grafana.becklab.cloud`.

**Middleware / Ingress:**
- Route: `grafana.becklab.cloud` → Service `kube-prometheus-stack-grafana`.
- SSO chain: Likely uses the `sso-admin-chain` (oauth2-redirect → keycloak-forward-auth) so only authenticated admins can access dashboards.

**Environment variables (Helm defaults):**
- `GRAANA_ADMIN_USER` / `ADMIN_PASSWORD` — admin credentials (from Helm secrets).
- `GF_SECURITY_ADMIN_EMAIL`, `GF_SERVER_ROOT_URL` — set to the Ingress hostname.
- Data source URLs for Prometheus, etc.

**Notes:** Grafana is the front-end for all observability; without it, you have no way to visualize metrics or run ad-hoc queries.