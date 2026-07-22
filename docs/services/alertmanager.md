# alertmanager

**Purpose:** Alertmanager — routes, groups, and sends notifications for Prometheus alerts.

**What it does:** Alertmanager receives alerting rules from Prometheus, deduplicates them, and delivers them via configured channels (webhook, email, etc.). In this cluster it runs as a single replica statefulset with no persistent storage (data is in-memory; on restart it reinitializes from the config). It works in tandem with Grafana for alert dashboards.

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not set (uses Helm defaults, typically very low) |
| PVCs | None (ephemeral) |

**Ports:**
- `9093` — HTTP API and gRPC. Internal only; Prometheus pushes alerts here.
- `8080` — Web UI for alert management (if enabled).

**Middleware / Ingress:**
- No external exposure; all alert routing is internal.

**Environment variables (Helm defaults):**
- `ALERTMANAGER_CONFIG` — path to the Alertmanager configuration YAML (contains receivers, route tree, etc.).
- Other defaults for clustering, storage on-disk disabled.

**Notes:** Without Alertmanager, Prometheus alerts would be sent raw and unstructured; this service provides the necessary grouping and templating before delivery.