# wazuh-indexer

**Purpose:** Wazuh indexer — stores all security logs, alerts, and agent data.

**What it does:** The indexer is a distributed Elasticsearch-compatible cluster that ingests logs from agents via the Wazuh manager, applies ILM (index lifecycle management), and serves read requests to the dashboard and API. It runs as a StatefulSet with a 50 GiB persistent volume for each node.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 1 limit |
| RAM | 2Gi request / 3Gi limit |
| PVCs | `wazuh-indexer-wazuh-indexer-0` (50 GiB, local-path) — single-node indexer |

**Ports:**
- `9200` — HTTP REST API for indexing and querying.
- `9300` — Inter-node communication (transport protocol).

**Middleware / Ingress:**
- Internal only; no public hostname. The dashboard accesses it directly via the service name.

**Environment variables (Helm defaults):**
- `discovery.type: single-node` — runs as a solo indexer in this deployment.
- `INDEX_PREFIX` — typically `wazuh-alerts-*`.
- ILM and rollover policies injected by Helm.

**Notes:** This is the data lake for all security events; its health directly impacts alerting reliability.