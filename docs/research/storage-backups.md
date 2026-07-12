# Storage & Backups Deep Dive

**Last audited:** 2026-07-12  
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
       │     └── torrent-downloads-lvm → 5Ti RWX → torrent/torrent-downloads (PVC)
       │
       └── k3s-worker-1: /var/lib/rancher/k3s/storage/ (local-path provisioner data)

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
| torrent-downloads-lvm | 5 TiB | RWX | torrent/torrent-downloads | Torrent completion directory |
| minio-data | 200 GiB | RWO | velero/minio-data | Velero backup object store |

### Service Configuration Volumes (local-path, RWO, Delete)

| PVC Name | Namespace | Size | Purpose |
|----------|-----------|------|---------|
| bitwarden/bitwarden-data | bitwarden | 10 GiB | Vaultwarden database + attachments |
| cms/directus-data | cms | 2 GiB | Directus uploads and extensions |
| gaming/crafty-config | gaming | 1 GiB | Crafty Controller config |
| gaming/crafty-world | gaming | 20 GiB | Minecraft world data |
| gaming/crafty-logs | gaming | 5 GiB | Server logs |
| gaming/crafty-import | gaming | 20 GiB | Resource pack imports |
| gaming/crafty-backup | gaming | 20 GiB | World backups |
| gaming/pg-data-pp-postgres-0 | gaming | 5 GiB | PostgreSQL data (Minecraft auth) |
| identity/lldap-data | identity | 5 GiB | LLDAP database |
| identity/data-keycloak-postgresql-0 | identity | 10 GiB | Keycloak PostgreSQL data |
| identity/data-redis-0 | identity | 1 GiB | Redis session store for oauth2-proxy |
| media/sonarr-config | media | 10 GiB | Sonarr config + DB |
| media/radarr-config | media | 10 GiB | Radarr config + DB |
| media/prowlarr-config | media | 5 GiB | Prowlarr config + DB |
| media/bazarr-config | media | 5 GiB | Bazarr config + DB |
| media/nzbget-config | media | 5 GiB | nzbget config |
| media/sabnzbd-config | media | 5 GiB | SABnzbd config |
| media/jellyfin-config | media | 20 GiB | Jellyfin metadata + transcode cache |
| media/jellyseerr-config | media | 10 GiB | Jellyseerr (Seerr) config + DB |
| media/homebox-config | media | 10 GiB | Homebox inventory DB |
| media/tdarr-config | media | 5 GiB | Tdarr transcode config |
| monitoring/kube-prometheus-stack-grafana | monitoring | 10 GiB | Grafana dashboards + datasources |
| monitoring/prometheus-kps-prometheus-db-prometheus-kps-prometheus-0 | monitoring | 50 GiB | Prometheus TSDB |
| monitoring/alertmanager-kps-alertmanager-db-alertmanager-kps-alertmanager-0 | monitoring | 5 GiB | Alertmanager state |
| spotweb/spotweb-config | spotweb | 1 GiB | SpotWeb config |
| spotweb/data-mariadb-0 | spotweb | 5 GiB | MariaDB for SpotWeb |
| torrent/qbit-config | torrent | 5 GiB | qBittorrent + Gluetun config |

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
| velero-0 | `0 */6 * * *` | identity | 30 days (720h) | Every 6 hours | 2026-07-08T12:00:14Z |
| velero-1 | `0 2 * * *` | security | 90 days (2160h) | Daily at 02:00 UTC | 2026-07-08T02:00:14Z |
| velero-2 | `0 1 * * *` | media, torrent | 14 days (336h) | Daily at 01:00 UTC | 2026-07-08T01:00:13Z |
| velero-3 | `0 4 * * *` | cattle-system | 30 days (720h) | Daily at 04:00 UTC | 2026-07-08T04:00:14Z |
| velero-4 | `0 2 * * 0` | ALL namespaces | 90 days (2160h) | Weekly Sunday at 02:00 UTC | 2026-07-05T02:00:10Z |

### Backup Configuration
All schedules use `snapshotVolumes: false` and `defaultVolumesToFsBackup: true`, meaning Velero performs filesystem-level backups via the node-agent rather than cloud volume snapshots. This is appropriate for a VM-based infrastructure where block volume snapshots aren't available.

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
| Media library (LVM PVs) | ~140 TiB | anime(45T) + movies(45T) + shows(45T) + downloads(5T) + torrent(5T) |
| Velero MinIO data | 200 GiB | Backup object store |
| Service configs (local-path) | ~280 GiB | Sum of all PVCs on local-path provisioner |
| **Total persistent storage** | **~140.6 PiB + 480 GiB** | Media dominates by far |

---

*End of storage & backups deep dive.*
