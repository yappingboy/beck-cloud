# mariadb

**Purpose:** MariaDB/PostgreSQL database for the media stack.

**What it does:** This is the relational database backend for Homebox (and potentially other metadata services). It runs as a StatefulSet with persistent storage, providing stable network identity and data durability. All media inventory data is stored here.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `mariadb-data` (not listed in the previous scan, but implied by StatefulSet) — typically ~5–10 GiB depending on chart defaults |

**Ports:**
- `3306` — MySQL/MariaDB protocol. Exposed as a ClusterIP service; accessed only internally by Homebox and other services.

**Middleware / Ingress:**
- No external exposure; purely internal database.

**Environment variables (Helm defaults):**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — credentials injected via Kubernetes secret.
- `PGDATA` — mounted from PVC.

**Notes:** While named "mariadb", the container image is actually PostgreSQL; the service name follows the chart conventions. It's a critical backend for media metadata and should be kept healthy.