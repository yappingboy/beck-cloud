# trivy-operator

**Purpose:** Kubernetes-native vulnerability scanner for container images and cluster resources.

**What it does:** Trivy Operator continuously scans workloads across the cluster for image vulnerabilities and misconfigurations. It creates Kubernetes-native `VulnerabilityReport` and `ConfigAuditReport` CRDs that other tools (e.g. Wazuh, Grafana) can consume. Installed via Helm chart v0.32.0 (aqua-charts repo) and managed by Flux HelmRelease in the `security` namespace.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| Cache | Trivy cache volume (10 GiB) on node `ip-172-16-0-20`, tolerating control-plane NoSchedule taint |

**Deployment topology:**
- **Type:** Deployment — single replica (1 pod).
- **Namespace:** `security` (cluster-wide RBAC, scans all namespaces not excluded).

**Configuration (from HelmRelease values):**
- `trivy.image` — `docker.io/aquasec/trivy:0.68.1`, `ignoreUnfixed: true`, `offlineScan: false`.
- `operator.excludeNamespaces` — `kube-system`, `trivy-system`, `cert-manager`, `monitoring`, `cattle-system`.
- `operator.scanInterval` — 12h.
- `operator.metricsPort` — 8080.
- `rbac.clusterWide` — true.
- Flux `interval: 1m` on the HelmRelease.

**Output:** Creates `VulnerabilityReport` and `ConfigAuditReport` CRDs per workload. These can be queried by other tools for dashboards, alerts, or compliance reporting.

**Notes:** Trivy runs as a single Deployment since it's a control-plane operator — only one instance is needed to manage cluster-wide scans. The operator reconciles on the 12h scan interval and reports findings as native Kubernetes resources rather than external databases.
