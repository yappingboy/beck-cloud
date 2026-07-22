# wazuh-manager-master

**Purpose:** Wazuh manager node — central coordination, rule/decoder updates, and cluster management.

**What it does:** The master manager orchestrates the Wazuh cluster: it distributes configuration (rules, decoders, active responses), coordinates indexers for log storage, and acts as the primary admin interface. It runs as a StatefulSet with persistent storage for its internal database and configuration files.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 1 limit |
| RAM | 512Mi request / 1Gi limit |
| PVCs | `wazuh-manager-master-0` (50 GiB, local-path) for database and configs |

**Ports:**
- `1514` — Wazuh agent communication protocol (UDP/TCP)
- `1515` — REST API (web UI)
- `514` — Syslog (if enabled)

**Middleware / Ingress:**
- Internal service; not exposed directly. The dashboard (`wazuh-dashboard`) provides the web UI at port 5601, which may be routed via Traefik if needed.

**Environment variables (Helm defaults):**
- `WAZUH_MANAGER` — hostname of the master manager.
- `WAZUH_INDEXER` — indexers endpoint (`wazuh-indexer`).
- Cluster settings (`CLUSTER_NAME`, `NODE_NAME`, etc.).

**Notes:** The manager is the brain of the Wazuh stack; all agents report to it, and it pushes updates to them.