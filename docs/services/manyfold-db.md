# manyfold-db

**Purpose:** PostgreSQL database backend for Manyfold.

**What it does:** Runs PostgreSQL 17 (Alpine edition) to store Manyfold's relational data — model metadata, collections, tags, users, and scan results. The database name is `manyfold_production` with user `manyfold`. Data is persisted on a 5 GiB local-path PVC. This is a Deployment (not a StatefulSet), pinned to the K3s worker node.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `manyfold-config` (5 GiB, local-path, node `ip-192-168-100-11`) |

**Ports:**
- `5432` — PostgreSQL (ClusterIP, internal only).

**Middleware / Ingress:**
- None — internal database service, no external access.

**Environment variables:**
- `POSTGRES_USER` — `manyfold`
- `POSTGRES_PASSWORD` — from secret `manyfold-db-secret-79d6tmgb42` (key: `password`)
- `POSTGRES_DB` — `manyfold_production`

**Notes:** Only the `manyfold` deployment in the `3dprinting` namespace should connect to this service. The `DATABASE_URL` secret used by Manyfold references the same secret object for both the connection string and password.
