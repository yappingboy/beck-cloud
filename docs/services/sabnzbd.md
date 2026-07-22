# sabnzbd

**Purpose:** SABnzbd — NZB download client (alternative to NZBGet).

**What it does:** SABnzbd fetches and processes NZB files, placing them into the shared media catalog. It runs alongside NZBGet, providing redundancy and different configuration options. The service exposes an HTTP API for management.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 800m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `sabnzbd-config` (5 GiB, local-path) for settings and queue |

**Ports:**
- Default SABnzbd port is 8080 (HTTP API). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname.

**Environment variables (Helm defaults):**
- `SABNZBD_CONFIG_DIR` — points to PVC.
- `CATALOG` — shared media directory.
- Other defaults for sorting, post-processing, etc.

**Notes:** Both NZBGet and SABnzbd write to the same storage pool; Jellyfin's library scanning picks up files from either source.