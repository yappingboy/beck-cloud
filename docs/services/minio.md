# minio

**Purpose:** MinIO — high-performance object storage for Velero backups.

**What it does:** MinIO (`quay.io/minio/minio:latest`) provides S3-compatible object storage that backs up and restores all Kubernetes namespaces via Velero. It also serves as the repository for Restic snapshots (used by certain backup strategies). The service runs as a single container. Data lives on the `minio-data` PVC (200 GiB), backed by an NFS PersistentVolume at `172.16.0.7:/var/lib/one/datastores/minio-data`. The pod is pinned to node `ip-172-16-0-20` via node affinity.

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not set (unconstrained) — MinIO scales with disk I/O and network load |
| PVCs | `minio-data` (200 GiB, NFS-backed PV, RWO, Retain) |

**Ports:**
- `9000` — S3 API (REST) for all backup/restore operations.
- `9001` — Web console (admin UI).

**Middleware / Ingress:**
- Internal only. Velero accesses MinIO directly via its service name (`minio`). No Traefik routing needed.

**Environment variables:**
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — from secret `minio-credentials` (keys: `accesskey`, `secretkey`).
- `MINIO_BROWSER` (`on`) — console access enabled.
- Server args: `server /data --console-address :9001`.

**Notes:** MinIO is the backbone of BeckCloud's backup strategy. Its health directly impacts recovery time. A bucket-init Job (`minio-make-bucket`, using `quay.io/minio/mc:latest`) creates the `velero-backups` bucket on first run.
