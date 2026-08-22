# mariadb

**Purpose:** MariaDB database for Spotweb (media namespace).

**What it does:** This is the relational database backend for the Spotweb app. It runs as a StatefulSet (`mariadb`, namespace `media`) with image `mariadb:11` and a 5 GiB local-path PVC from a volume claim template. Spotweb's own IngressRoute lives in `infrastructure/media/spotweb/`.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `data` (5 GiB, local-path) via `volumeClaimTemplates` |

**Ports:**
- `3306` — MySQL/MariaDB protocol. Exposed as a ClusterIP service. Accessed only internally by Spotweb.

**Middleware / Ingress:**
- No external exposure. Purely internal database.

**Environment variables:**
- `MYSQL_ROOT_PASSWORD` — from secret `spotweb-secrets` (key: `db_password`).
- `MYSQL_DATABASE` — `spotweb`.
- `MYSQL_USER` — `spotweb`.
- `MYSQL_PASSWORD` — from secret `spotweb-secrets` (key: `db_password`).

**Notes:** Despite the PostgreSQL-flavored claims in older docs, the container image is MariaDB 11. It is a critical backend for Spotweb metadata and should be kept healthy.
