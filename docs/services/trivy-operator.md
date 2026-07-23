# trivy-operator

**Purpose:** Kubernetes-native vulnerability scanner for container images and cluster resources.

**What it does:** Trivy Operator (v0.30.0) continuously scans all workloads across every namespace for image vulnerabilities, misconfigurations, and exposed secrets. It creates Kubernetes-native `VulnerabilityReport` and `ConfigAuditReport` CRDs that other tools (e.g. Wazuh, Grafana) can consume. Installed via Helm chart v0.32.0 and managed by Flux.

**Resources:**
| Type | Details |
|------|---------|
| CPU | None (unconstrained) |
| RAM | None (unconstrained) |
| Volumes | `emptyDir` for policy cache (`cache-policies`) |

**Ports:**
- `8080` — HTTP API
- `9090` — Prometheus metrics

**Health probes:**
- **Liveness:** `GET /probes/healthz/` (delay 5s, period 10s, failure threshold 10)
- **Readiness:** `GET /probes/readyz/` (delay 5s, period 10s, failure threshold 3)

**Deployment topology:**
- **Type:** Deployment — single replica (1 pod).
- **Strategy:** Recreate (no rolling update).
- **ServiceAccount:** `trivy-operator`
- **Namespace:** `security` (but scans all namespaces cluster-wide).

**Configuration (from `trivy-operator-config` ConfigMap):**
| Variable | Value | Purpose |
|----------|-------|---------|
| `OPERATOR_NAMESPACE` | `security` | Where the operator runs |
| `OPERATOR_TARGET_NAMESPACES` | *(empty)* | Scans all namespaces |
| `OPERATOR_EXCLUDE_NAMESPACES` | *(empty)* | No namespaces excluded |
| `OPERATOR_TARGET_WORKLOADS` | `pod,replicaset,replicationcontroller,statefulset,daemonset,cronjob,job` | Workload types to scan |
| `OPERATOR_SERVICE_ACCOUNT` | `trivy-operator` | SA used for scanning |

**Output:** Creates `VulnerabilityReport` and `ConfigAuditReport` CRDs per workload. These can be queried by other tools for dashboards, alerts, or compliance reporting.

**Notes:** Trivy runs as a single Deployment since it's a control-plane operator — only one instance is needed to manage cluster-wide scans. The operator reconciles on a configurable schedule and reports findings as native Kubernetes resources rather than external databases.
