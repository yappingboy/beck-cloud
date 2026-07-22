# wazuh-manager-worker

**Purpose:** Wazuh worker nodes — process events and run local analysis.

**What it does:** Worker managers handle incoming logs from agents, apply rules/decoders locally, and forward alerts to the master manager and indexers. This namespace runs two identical StatefulSet replicas for high availability. Each replica has its own PVC.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 1 limit |
| RAM | 512Mi request / 1Gi limit |
| PVCs | `wazuh-manager-worker-0` (50 GiB), `wazuh-manager-worker-1` (50 GiB) — both local-path |

**Ports:**
- `1514` — Agent communication (receives from agents, forwards to master)
- `1516` — Internal cluster heartbeat between workers and master

**Middleware / Ingress:**
- Internal only; no external exposure. The master manages cluster membership via these ports.

**Environment variables (Helm defaults):**
- `WAZUH_MANAGER` — points to the master manager service.
- `WAZUH_INDEXER` — indexer endpoint for log shipping.
- `NODE_NAME` and cluster-related vars injected by Helm.

**Notes:** Workers are stateless from an application perspective; all persistent data lives on their PVCs. They scale out easily if more agent volume is expected.