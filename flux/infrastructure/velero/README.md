# velero

**Purpose:** Backup and disaster recovery

**What it does:** Deploys Velero v1.15.0 with MinIO (200Gi) object storage. Runs scheduled backups: identity ns (every 6h, 30d), security ns (daily, 90d), media+torrent (daily, 14d), cattle-system (daily, 30d), all namespaces weekly (90d). Uses restic uploader.

**Special resources:** MinIO for Velero object storage, 200Gi PV for MinIO data.
