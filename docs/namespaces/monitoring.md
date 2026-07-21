# monitoring

**Purpose:** Observability stack.

**What it does:** Runs the Prometheus server and Grafana dashboards (via the `kube-prometheus-stack` Helm chart, version 65.5.0). This namespace collects metrics from all other namespaces, exposes them via the `/metrics` endpoint, and serves an admin-authenticated UI at `grafana.becklab.cloud`. It is the central nervous system for cluster health, resource utilization, and alerting.
