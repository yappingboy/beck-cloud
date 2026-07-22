# prometheus

**Purpose:** Prometheus — metrics collection and alerting engine for the BeckCloud.

**What it does:** Prometheus scrapes metrics from all nodes, pods, and services, stores them in a time-series database, and serves them via an HTTP API. It drives Grafana dashboards and can trigger alerts (though alert routing is handled by Alertmanager). The deployment runs as a StatefulSet with persistent storage for data retention.

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not explicitly set in the Helm chart; relies on Kubernetes defaults (usually 1 CPU / 2 GiB) |
| PVCs | `prometheus-kps-prometheus-db` (50 GiB, local-path) for time-series data |

**Ports:**
- `9090` — Prometheus HTTP API and metrics endpoint. Exposed internally; typically accessed via Grafana or direct queries.

**Middleware / Ingress:**
- No external IngressRoute; metrics are consumed internally by Grafana (port 80) and Alertmanager.

**Environment variables (Helm defaults):**
- `PROMETHEUS_RETENTION_TIME` — how long to keep data (default ~15 days).
- `PROMETHEUS_EXTERNAL_LABELS` — cluster labeling for multi-cluster setups.
- Service discovery settings for scraping pods and nodes.

**Notes:** Prometheus is the heart of BeckCloud observability; all dashboards and alerts depend on its health.