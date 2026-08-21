# wazuh-dashboard

**Purpose:** Wazuh web UI — security monitoring console.

**What it does:** The dashboard provides a Kibana-based interface for viewing alerts, logs, and system health in real time. It connects to the Wazuh indexer (Elasticsearch-compatible) for data retrieval. Runs as a single Deployment with modest resource needs.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 250m request / 1 limit |
| RAM | 512Mi request / 1Gi limit |
| PVCs | None (ephemeral. Data stored on indexer) |

**Ports:**
- `5601` — Kibana UI (HTTP). Exposed internally. Can be routed via Traefik if needed.

**Middleware / Ingress:**
- Internal service. No SSO chain applied. Access is typically restricted to admins via network policy or firewall rules rather than OAuth2-proxy.

**Environment variables (Helm defaults):**
- `ELASTICSEARCH_HOSTS` — points to `wazuh-indexer`.
- `WAZUH_API_URL` — for authentication and metadata.
- Other Kibana defaults (i18n, theme.).

**Notes:** The dashboard is the primary user interface for security analysts. All alerts originate here.