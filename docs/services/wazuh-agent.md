# wazuh-agent

**Purpose:** Wazuh agent — lightweight security monitoring daemon.

**What it does:** Installed on every host (via DaemonSet), the agent collects logs, monitors file integrity, executes active responses, and reports metrics/alerts back to the Wazuh manager. It runs with minimal footprint: only 50m CPU and 64Mi RAM by default, scaling up if needed.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 100m limit |
| RAM | 64Mi request / 128Mi limit |
| PVCs | None — all data sent to the manager; local files are monitored but not stored in K8s PVCs |

**Ports:**
- `514` — Syslog (agent → manager)
- `1514` — Wazuh protocol (agent ↔ manager)
- `5044` — API communication (for remote management)

**Middleware / Ingress:**
- Internal to the cluster; agents register with the master manager service.

**Environment variables (Helm defaults):**
- `WAZUH_MANAGER` — hostname/IP of the master manager.
- `WAZUH_AGENT_NAME`, `WAZUH_NODE_NAME` — unique identifiers per host.
- `WAZUH_REGISTRATION_PASSWORD` — for onboarding.

**Notes:** The agent is the eyes and ears of the security stack; its health is critical for any alerting gaps.