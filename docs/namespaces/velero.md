# velero

**Purpose:** Backup and restore.

**What it does:** Runs Velero v1.15.0 with five scheduled backups:
- **identity:** every 6 hours (30-day retention)
- **security:** daily at 02:00 (90-day retention)
- **media + torrent:** daily at 01:00 (14-day retention)
- **cattle-system:** daily at 04:00 (30-day retention)
- **full cluster:** weekly on Sundays at 02:00 (90-day retention)

Velero stores backup objects in MinIO (200 GiB provisioned). Note that the large LVM-backed media data (~140 TiB) is *not* included in Velero backups.
