# velero/minio

**Purpose:** MinIO object storage for Velero backups

**What it does:** MinIO deployment with PV, PVC, credentials, service, and bucket initialization. Used as Velero's object storage backend (200Gi).

**Services:**
- `minio` — MinIO deployment
- `pv` — MinIO PersistentVolume
- `pvc` — MinIO PersistentVolumeClaim
- `credentials` — MinIO access key secret
- `service` — MinIO Service
- `bucket-init` — Bucket initialization job
