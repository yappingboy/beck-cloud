# Storage & Backups Deep Dive

**Last audited:** 2026-07-20  
**Scope:** Persistent volumes, storage classes, Velero backup strategy, MinIO object storage

---

## Storage Architecture

```
Host (AlmaLinux 9)
 └── ZFS pool
       │
       ▼
OpenNebula VMs with LVM inside
       │
       ├── k3s-server: /dev/volumes/ (LVM VG for K3s + media storage)
       │     ├── media-anime-lvm    → 45Ti RWX → media/media-anime (PVC)
       │     ├── media-movies-lvm   → 45Ti RWX → media/media-movies (PVC)
       │     ├── media-shows-lvm    → 45Ti RWX → media/media-shows (PVC)
       │     ├── media-downloads-lvm → 5Ti RWX → media/media-downloads (PVC)
       │     └── minio-data         → 200Gi RWO → velero/minio-data (PVC)
       │
       └── k3s-worker-1: /var/lib/rancher/k3s/storage/ (local-path provisioner data)
           └── ~55 PVCs on local-path provisioner (service configs, databases)

```

## Storage Classes

| Name | Provisioner | Reclaim Policy | Binding Mode | Default? | Purpose |
|------|------------|---------------|-------------|----------|---------|
| `local-path` | rancher.io/local-path | Delete | WaitForFirstConsumer | ✅ Yes | K3s default, service configs and databases |

> **Note:** The existing docs mention an `nfs-media` storage class but it's NOT present in the live cluster. Media storage uses static LVM PVs instead of dynamic provisioning.

## Persistent Volumes (Static)

### Large Media Volumes (LVM, RWX, Retain)

| Name | Size | Access Mode | Claim | Purpose |
|------|------|-------------|-------|---------|
| media-anime-lvm | 45 TiB | RWX | media/media-anime | Anime library storage |
| media-movies-lvm | 45 TiB | RWX | media/media-movies | Movie library storage |
| media-shows-lvm | 45 TiB | RWX | media/media-shows | TV show library storage |
| media-downloads-lvm | 5 TiB | RWX | media/media-downloads | Download staging area |
| minio-data | 200 GiB | RWO | velero/minio-data | Velero backup object store |
| torrent-downloads-lvm | 5 TiB | RWX | *(Released)* | Torrent downloads — PV released, torrent namespace emptied |

### Persistent Volume Claims by Namespace

#### `3dprinting` (7 PVCs — NEW)

| PVC Name | Size | Purpose |
|----------|------|---------|
| bumpmesh-html | 200Mi | BumpMesh static HTML |
| fdm-monster-database | 5Gi | FDM Monster database |
| fdm-monster-media | 5Gi | FDM Monster media files |
| manyfold-config | 5Gi | Manyfold configuration |
| manyfold-libraries | 50Gi | Manyfold 3D model libraries |
| orcaslicer-config | 5Gi | OrcaSlicer configuration |
| spoolman-data | 2Gi | Spoolman filament tracking data |

#### `gaming` (6 PVCs)

| PVC Name | Size | Purpose |
|----------|------|---------|
| crafty-backup | 20Gi | World backups |
| crafty-config | 1Gi | Crafty Controller config |
| crafty-import | 20Gi | Resource pack imports |
| crafty-logs | 5Gi | Server logs |
| crafty-world | 20Gi | Minecraft world data |
| pg-data-pp-postgres-0 | 5Gi | PostgreSQL data (Minecraft auth) |

#### `gridspace` (1 PVC — NEW)

| PVC Name | Size | Purpose |
|----------|------|---------|
| gridspace-data | 2Gi | Gridspace application data |

#### `identity` (3 PVCs)

| PVC Name | Size | Purpose |
|----------|------|---------|
| data-keycloak-postgresql-0 | 10Gi | Keycloak PostgreSQL data |
| data-redis-0 | 1Gi | Redis session store for oauth2-proxy |
| lldap-data | 5Gi | LLDAP database |

#### `media` (15 PVCs)

| PVC Name | Size | Purpose |
|----------|------|---------|
| bazarr-config | 5Gi | Bazarr config + DB |
| data-mariadb-0 | 5Gi | MariaDB for SpotWeb |
| homebox-config | 10Gi | Homebox inventory DB |
| jellyfin-config | 20Gi | Jellyfin metadata + transcode cache |
| jellyseerr-config | 10Gi | Jellyseerr (Seerr) config + DB |
| media-anime | 45Ti | Anime library (LVM PV) |
| media-downloads | 5Ti | Download staging (LVM PV) |
| media-movies | 45Ti | Movie library (LVM PV) |
| media-shows | 45Ti | TV show library (LVM PV) |
| nzbget-config | 5Gi | nzbget config |
| prowlarr-config | 5Gi | Prowlarr config + DB |
| qbit-config | 5Gi | qBittorrent + Gluetun config |
| radarr-config | 10Gi | Radarr config + DB |
| sabnzbd-config | 5Gi | SABnzbd config |
| sonarr-config | 10Gi | Sonarr config + DB |
| spotweb-config | 1Gi | SpotWeb config |
| tdarr-config | 5Gi | Tdarr transcode config |
| torrent-downloads | 0 | Pending (torrent-downloads-lvm released) |

#### `monitoring` (3 PVCs)

| PVC Name | Size | Purpose |
|----------|------|---------|
| alertmanager-kps-alertmanager-db-alertmanager-kps-alertmanager-0 | 5Gi | Alertmanager state |
| kube-prometheus-stack-grafana | 10Gi | Grafana dashboards + datasources |
| prometheus-kps-prometheus-db-prometheus-kps-prometheus-0 | 50Gi | Prometheus TSDB |

#### `security` (4 PVCs)

| PVC Name | Size | Purpose |
|----------|------|---------|
| wazuh-indexer-wazuh-indexer-0 | 50Gi | Wazuh OpenSearch indexer |
| wazuh-manager-master-wazuh-manager-master-0 | 50Gi | Wazuh manager master data |
| wazuh-manager-worker-wazuh-manager-worker-0 | 50Gi | Wazuh manager worker 0 data |
| wazuh-manager-worker-wazuh-manager-worker-1 | 50Gi | Wazuh manager worker 1 data |

#### `velero` (1 PVC)

| PVC Name | Size | Purpose |
|----------|------|---------|
| minio-data | 200Gi | Velero backup object store (LVM PV) |

#### `webapps` (9 PVCs — NEW)

| PVC Name | Size | Purpose |
|----------|------|---------|
| affine-config | 1Gi | Affine configuration |
| affine-postgres-data | 10Gi | Affine PostgreSQL (pgvector) data |
| affine-storage | 20Gi | Affine file storage |
| bitwarden-data | 10Gi | Vaultwarden database + attachments |
| directus-data | 2Gi | Directus uploads and extensions |
| home-assistant-config | 5Gi | Home Assistant configuration |
| silex-hosting | 4Gi | Silex user projects |
| silex-root | 4Gi | Silex application root |

---

## Backup Strategy (Velero v1.15.0)

### Infrastructure
- **Helm chart:** velero v8.0.0
- **Version:** Velero v1.15.0
- **Object storage:** MinIO at `http://minio.velero.svc.cluster.local:9000` (S3-compatible, path-style)
- **Region:** us-east-1 (MinIO doesn't enforce regions but requires one)
- **Access mode:** ReadWrite
- **Node agent:** Deployed as DaemonSet on both nodes for FS backup support

### Backup Schedules

| Schedule | Cron Expression | Namespaces | Retention (TTL) | Frequency | Last Run |
|----------|----------------|-----------|----------------|-----------|----------|
| velero-0 | `0 */6 * * *` | identity | 30 days (720h) | Every 6 hours | 2026-07-20T00:02:36Z |
| velero-1 | `0 2 * * *` | security | 90 days (2160h) | Daily at 02:00 UTC | 2026-07-19T02:00:35Z |
| velero-2 | `0 1 * * *` | media, torrent | 14 days (336h) | Daily at 01:00 UTC | 2026-07-20T01:00:36Z |
| velero-3 | `0 4 * * *` | cattle-system | 30 days (720h) | Daily at 04:00 UTC | 2026-07-19T04:00:35Z |
| velero-4 | `0 2 * * 0` | ALL namespaces | 90 days (2160h) | Weekly Sunday 02:00 UTC | 2026-07-19T02:00:35Z |

> **Updated:** All schedules have been running consistently since July 19. Previous audit showed last runs from July 8.

### Backup Configuration
All schedules use `snapshotVolumes: false` and `defaultVolumesToFsBackup: true`, meaning Velero performs filesystem-level backups via the node-agent rather than cloud volume snapshots. This is appropriate for a VM-based infrastructure where block volume snapshots aren't available.

### Recent Backup Activity

| Backup Name | Age | Schedule |
|-------------|-----|----------|
| velero-2-20260720010036 | 23m | velero-2 (media+torrent) |
| velero-0-20260720000236 | 81m | velero-0 (identity) |
| velero-0-20260719200136 | 5h22m | velero-0 (identity) |
| velero-0-20260719120035 | 13h | velero-0 (identity) |
| velero-0-20260719060035 | 19h | velero-0 (identity) |
| velero-3-20260719040035 | 21h | velero-3 (cattle-system) |
| velero-4-20260719020035 | 23h | velero-4 (full cluster) |
| velero-1-20260719020035 | 23h | velero-1 (security) |
| velero-2-20260719010035 | 24h | velero-2 (media+torrent) |

### Velero Restic Maintain Jobs

All namespaces have active restic maintain jobs running periodically. Note:

- **⚠️ Warning:** `velero-default-restic-c76vn` maintain jobs for the velero namespace itself are repeatedly entering Error state (3 failed attempts in the last 12 minutes at time of audit). This may indicate a self-referential backup issue where Velero struggles to back up its own PVC.

### Important Notes
- **Volume data IS included** via FS backup (node-agent reads PVC content on each node)
- **Minio-data PV itself** lives in velero namespace — Velero backs up its own storage backend's metadata but the actual S3 buckets are stored on the minio-data LVM volume
- **Media library files** (the 180+ TiB of movies/shows/anime) are NOT backed up by Velero — these live on large LVM PVs that would take impractical time to backup at full frequency. Recovery plan for media should be documented separately.

---

## CSI Snapshotter

The cluster has a snapshot class deployed via Flux (`flux/infrastructure/csi-snapshotter/`), though `snapshotVolumes: false` is set on all Velero schedules, so snapshots are currently not being used in backups. This may be for future use or manual disaster recovery procedures.

---

## Storage Capacity Summary

| Category | Total Used | Notes |
|----------|-----------|-------|
| Media library (LVM PVs) | ~140 TiB | anime(45T) + movies(45T) + shows(45T) + downloads(5T) |
| Velero MinIO data | 200 GiB | Backup object store |
| 3D Printing PVCs | ~72 GiB | 7 PVCs on local-path |
| Security PVCs | 200 GiB | Wazuh stack (4 × 50Gi) |
| Webapps PVCs | ~51 GiB | 9 PVCs on local-path |
| Other service configs | ~160 GiB | identity, gaming, media, monitoring, gridspace |
| **Total persistent storage** | **~140.6 PiB + 483 GiB** | Media dominates by far |

---

*End of storage & backups deep dive.*
