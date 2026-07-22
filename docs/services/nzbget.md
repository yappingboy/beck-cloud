# nzbget

**Purpose:** NZBGet — NZB and torrent download client.

**What it does:** NZBGet fetches NZB files (via NZB indexing services) and torrents, then stores them in the shared media volume for Jellyfin/Radarr/Sonarr to process. It runs as a container with moderate resources and persistent config.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 800m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `nzbget-config` (5 GiB, local-path) for settings and download queue |

**Ports:**
- Default NZBGet port is 6789 (HTTP API). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname.

**Environment variables (Helm defaults):**
- `NZBGET_CONFIG_DIR` — points to PVC.
- `CATALOG` — shared media directory path.
- Other defaults for categories, scheduling, etc.

**Notes:** NZBGet is one of two download engines in the stack (the other being SABnzbd); both feed into the same storage pool.