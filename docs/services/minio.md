# minio

**Purpose:** MinIO — high‑performance object storage for Velero backups.

**What it does:** MinIO provides S3‑compatible object storage that backs up and restores all Kubernetes namespaces via Velero. It also serves as the repository for Restic snapshots (used by certain backup strategies). The service runs as a single container with no Kubernetes PVCs; its data is stored locally on the node where it's deployed (or in a cloud bucket if configured — in this cluster it's local).

**Resources:**
| Type | Details |
|------|---------|
| CPU/RAM | Not set (unconstrained) — MinIO scales with disk I/O and network load |

**Ports:**
- `9000` — S3 API (REST) for all backup/restore operations.
- `9001` — Web console (admin UI).

**Middleware / Ingress:**
- Internal only; Velero accesses MinIO directly via its service name (`minio`). No Traefik routing needed.

**Environment variables (Helm defaults):**
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` — admin credentials.
- `MINIO_VOLUMES` — mount point for data (local disk).
- `MINIO_BROWSER` — enabled to allow console access.

**Notes:** MinIO is the backbone of BeckCloud's backup strategy. Its health directly impacts recovery time; ensure the host node has sufficient free disk space (the Velero schedule uses ~200 GiB of object storage).