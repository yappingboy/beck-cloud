# prowlarr

**Purpose:** Prowlarr — universal indexer interface for all media services.

**What it does:** Prowlarr aggregates RSS feeds and API endpoints from multiple trackers (NZB, torrent), providing a unified way for Sonarr, Radarr, nzbget, and SABnzbd to query them. It runs as a lightweight container with minimal resource usage.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `prowlarr-config` (5 GiB, local-path) for indexer data |

**Ports:**
- Default Prowlarr port is 9696 (HTTP API). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname.

**Environment variables (Helm defaults):**
- `PROWLARR_CONFIG_DIR` — points to PVC.
- `MONITORING_ENABLED=true` — metrics exposed to Prometheus.

**Notes:** All download services (Sonarr, Radarr, nzbget, SABnzbd) depend on Prowlarr for tracker discovery and search.