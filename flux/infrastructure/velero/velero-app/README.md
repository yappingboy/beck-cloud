# velero/velero-app

**Purpose:** Velero backup agent

**What it does:** Velero HelmRelease, MinIO credentials secret, and ingress route. MinIO is in velero/minio subdir.

**Services:**
- `velero` — Velero HelmRelease
- `credentials-secret` — MinIO credentials Secret
- `ingressroute` — Velero ingress
