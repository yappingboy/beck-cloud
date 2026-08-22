# prometheus

**Purpose:** Prometheus — metrics collection and alerting engine for the BeckCloud.

**What it does:** Prometheus scrapes metrics from all nodes, pods, and services, stores them in a time-series database, and serves them via an HTTP API. It drives Grafana dashboards and can trigger alerts (though alert routing is handled by Alertmanager). The deployment runs as a StatefulSet with persistent storage for data retention.

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not explicitly set in the Helm chart. Relies on Kubernetes defaults (usually 1 CPU / 2 GiB) |
| PVCs | `kps-prometheus-db` (50 GiB, local-path) for time-series data |

**Ports:**
- `9090` — Prometheus HTTP API and metrics endpoint. Exposed internally. Typically accessed via Grafana or direct queries.

**Middleware / Ingress:**
- Route: `prometheus.becklab.cloud` → Prometheus (port 9090). Ingress enabled in Helm values with TLS secret `prometheus-tls` (letsencrypt-prod).
- SSO chain: `identity-sso-admin-chain@kubernetescrd` via ingress annotation.

**Environment variables (Helm defaults):**
- `PROMETHEUS_RETENTION_TIME` — 15 days, plus a 45 GB size cap (`retentionSize`).
- `PROMETHEUS_EXTERNAL_LABELS` — cluster labeling for multi-cluster setups.
- Service discovery settings for scraping pods and nodes.

**Notes:** Prometheus is the heart of BeckCloud observability. All dashboards and alerts depend on its health.