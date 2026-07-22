# spotweb

**Purpose:** Spotweb — torrent tracker management and community forum.

**What it does:** Spotweb runs the BeckCloud's private torrent trackers, allowing users to share and download media via magnet links. It also provides a web forum for community interaction. The service is lightweight but essential for the media ecosystem.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `spotweb-config` (1 GiB, local-path) for database and user data |

**Ports:**
- Default Spotweb port is 80 (HTTP). Exposed internally; likely proxied via Traefik with a custom hostname if needed.

**Middleware / Ingress:**
- Internal only in current config.

**Environment variables (Helm defaults):**
- `SPOTWEB_CONFIG_DIR` — points to PVC.
- Tracker URLs and API keys stored as secrets.

**Notes:** Spotweb is the backbone of the BeckCloud's private torrent network; all download clients post completed torrents back to Spotweb for indexing.