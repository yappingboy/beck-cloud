# spotweb

**Purpose:** Spotweb — torrent tracker management and community forum.

**What it does:** Spotweb runs the BeckCloud's private torrent trackers, allowing users to share and download media via magnet links. It also provides a web forum for community interaction. The service is lightweight but essential for the media ecosystem.

**Resources:**
| Type | Details |
|------|---------|
| DB image | `mariadb:11` (StatefulSet `mariadb`, 1 replica) |
| CPU (mariadb) | 100m request / 1 limit |
| RAM (mariadb) | 128Mi request / 512Mi limit |
| PVC | `data` (5 GiB, local-path, from volumeClaimTemplate) for MariaDB data |

**Ports:**
- Container `3306` (TCP) — MariaDB
- IngressRoute: `spotweb.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`), routes to service `spotweb` port `80`

**Environment variables (mariadb):**
- `MYSQL_DATABASE=spotweb`, `MYSQL_USER=spotweb`
- `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` from `spotweb-secrets` (Sops-encrypted)

**Notes:** The Flux dir defines only the MariaDB StatefulSet, the secret, and the IngressRoute. No spotweb Deployment or Service exists in this dir yet, so the IngressRoute has no live backend.

**Notes:** Spotweb is the backbone of the BeckCloud's private torrent network. All download clients post completed torrents back to Spotweb for indexing.