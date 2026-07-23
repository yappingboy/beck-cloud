# keycloak-postgresql

**Purpose:** PostgreSQL 16 database backing Keycloak's realm, user, and configuration data.

**What it does:** Runs as a StatefulSet with 1 replica in the `identity` namespace. Stores all Keycloak data including realms, clients, users, groups, and federation settings. The database is accessed exclusively by the Keycloak deployment via JDBC on port 5432. Data persists across restarts via a 10 GiB `local-path` PVC (`data-keycloak-postgresql-0`).

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `data-keycloak-postgresql-0` (10 GiB, local-path, RWO) |

**Ports:**
- `5432` — PostgreSQL (internal ClusterIP, headless service `None`).

**Key environment variables:**
- `POSTGRES_DB=keycloak`
- `POSTGRES_USER=keycloak`
- `POSTGRES_PASSWORD` — from `keycloak-postgres-password` secret.
- `PGDATA=/var/lib/postgresql/data/pgdata`

**Notes:** Deployed via Flux CD Kustomize (`kustomize.toolkit.fluxcd.io/name=infrastructure`). Uses the official `postgres:16` image. The headless service (`ClusterIP: None`) enables direct pod-to-pod communication via the StatefulSet hostname. Backups are handled externally (e.g., Velero snapshots of the PVC).
