# ZFS Migration Plan — Beck Cloud Homelab

> **Status:** Active — migration in progress
> **Current storage:** Rook-Ceph (being decommissioned)
> **Target:** Single-node ZFS pool (tank) with local-path-provisioner or ZFS CSI driver

---

## 1. Pool Architecture

### Drive Inventory
| Device | Size | Role |
|--------|------|------|
| sda, sdj, sdk, sdl, sdn, sdo, sdp | 5.5TB each | ZFS mirror pairs |
| sdi, sdm | 9.1TB each | ZFS mirror pair |
| sdg | 5.5TB | **Hot spare** |
| nvme1n1 | 476GB | **SLOG/ZIL** (write acceleration) |

### Pool Design: `tank`
```
zpool create -f tank \
  mirror sda sdj \
  mirror sdb sdk \
  mirror sdc sdl \
  mirror sdd sdn \
  mirror sde sdo \
  mirror sdf sdp \
  mirror sdi sdm \
  spare sdg \
  log nvme1n1
```

**Result:** 7×2 mirrors + 1 hot spare + NVMe SLOG
- **Raw capacity:** 7 × 5.5TB = 38.5TB (spare is reserved, not counted)
- **With compression (~30% avg for media/docs):** ~50TB effective
- **Single point of failure:** yes (single node, no replication to other host)
- **Mitigation:** regular ZFS snapshots + offsite backup for critical data

### Pool Properties
```
zfs set compression=lz4 tank
zfs set atime=off tank
zfs set recordsize=1M tank/media       # large sequential I/O (movies, VMs)
zfs set recordsize=128K tank/plex-meta  # small random I/O (metadata)
zfs set xattr=sa tank                   # store xattrs in inode (better performance)
zfs setacl=posixacl tank               # POSIX ACLs for NFS/SMB sharing
```

---

## 2. ZFS Datasets (Service Layout)

| Dataset | Purpose | recordsize | compress | snapshots |
|---------|---------|------------|----------|-----------|
| `tank/system` | K3s local storage | 128K | lz4 | daily×7, weekly×4 |
| `tank/media/plex` | Plex media | 1M | off | weekly |
| `tank/media/downloads` | Download staging | 1M | lz4 | daily×3 |
| `tank/media/library` | Processed media | 1M | off | daily×7 |
| `tank/media/configs` | App configs (sonarr/radarr etc.) | 128K | lz4 | daily×14 |
| `tank/logs` | Application logs | 128K | lz4 | daily×7 |
| `tank/backup` | Local backups | 128K | lz4 | daily×30 |
| `tank/k3s` | K3s persistent volumes | 128K | lz4 | daily×7 |
| `tank/torrent` | qBittorrent/staging | 1M | lz4 | daily×3 |
| `tank/plex-meta` | Plex metadata | 128K | off | weekly |

---

## 3. K3s Storage Integration

### Option A: local-path-provisioner (simplest)
```yaml
# storageclass-local-zfs.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-zfs
provisioner: rancher.io/local-path
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
parameters:
  hostDir: /tank/k3s
  mountDir: /data
```

### Option B: ZFS CSI Driver (dynamic, feature-rich)
```
helm install zfs-csi-driver openzfs/zfs-csi-driver \
  -n kube-system \
  --set node.zfsPath=/tank
```
Then create a StorageClass backed by ZFS datasets with dynamic provisioning, snapshots, and clones.

### Recommendation: Start with Option A, migrate to Option B later
- Option A is zero-dependency (already ships with K3s)
- Option B gives native ZFS snapshot support, which is the killer feature

---

## 4. Migration Strategy

### Phase 0: Preparation (Day 1)
1. Install OpenZFS on CentOS Stream 10
   ```bash
   dnf install -y https://openzfs.github.io/release/rpm/zfs-release-$(rpm -E %dist).noarch.rpm
   dnf install -y zfs
   ```
2. Create pool and datasets (dry run — no data yet)
3. Verify pool health: `zpool status`, `zpool scrub --start tank`
4. Install local-path-provisioner if not present

### Phase 1: Non-critical services (Days 2-3)
- **falco** (logs) → `tank/logs`
- **monitoring stack** → `tank/logs`
- **test pods** → clean up entirely
- Verify each service works with ZFS-backed PVC

### Phase 2: Media stack (Days 4-7)
- Migrate one service at a time:
  1. **qBittorrent** (torrent) → `tank/torrent`
  2. **Plex** (media) → `tank/media` (move existing media files)
  3. **Sonarr/Radarr** (config) → `tank/media/configs`
  4. **Jellyfin/Bazarr/Jellyseerr/Prowlarr** (config) → `tank/media/configs`
- Use `zfs send/receive` or `rsync` for large media transfers

### Phase 3: Traefik + Ceph teardown (Days 8-10)
- Point Traefik to `tank/system` or `tank/k3s`
- Verify all services running on ZFS
- **Stop Ceph:** `helm uninstall rook-ceph -n rook-ceph`
- **Remove Ceph CRDs, storageclasses, CSI**
- Remove Ceph LVM from HDDs
- Add HDDs to ZFS pool

### Phase 4: Cleanup & Optimization (Day 11)
- Run first full `zpool scrub tank`
- Configure ZFS snapshot schedules (cronjob or zfs-auto-snapshot)
- Set up offsite backup strategy (rclone to cloud storage)
- Update architecture docs

---

## 5. Rollback Plan

If ZFS migration fails at any phase:
1. **Phase 0-2:** Easy rollback — just stop ZFS-backed services, Ceph still running
2. **Phase 3:** Ceph data is still intact; revert K3s storageclass
3. **After HDD wipe:** If Ceph data was already destroyed, restore from backups
4. **Key:** Do NOT wipe Ceph OSDs until Phase 4 is verified working

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| nvme1n1 as SLOG fails | Write performance degrades | ZFS will fall back to sync writes to pool (safer, slower) |
| Single drive failure | Data loss (single node) | Regular snapshots + offsite backups |
| CentOS 10 OpenZFS compatibility | Build failures | Use official RPM repo or compile from source with kernel-headers |
| Media transfer downtime | 24-48h for full media library | Transfer during low-usage windows, use rsync with resume |
| ZFS pool corruption | Catastrophic data loss | `zpool scrub` weekly, regular backups, keep Ceph as emergency fallback |

---

## 7. Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Preparation | 1 day | OpenZFS install, pool creation |
| Non-critical services | 2 days | Testing, troubleshooting |
| Media stack | 3-5 days | Largest migration (TB of data) |
| Ceph teardown | 2 days | Service migration, cleanup |
| Cleanup & optimization | 1 day | Scrub, backup, docs |
| **Total** | **9-11 days** | ~2 weeks realistic buffer |

---

## 8. Alternative: Keep Ceph + Fix Issues

Before committing to ZFS, consider whether the Ceph issues are fixable:
- CephFS missing: need `CephFilesystem` CR (we added this in commit 66966e7)
- Ceph cluster version check: fixed with `cephVersion.image` patch (commit 098186b)
- Dashboard error: cosmetic issue (admin user creation failing)
- OSD processing: still running, just slow

**Ceph pros:** Distributed, multi-node capable, proven in production
**Ceph cons:** Complex, heavy resource usage, single-node doesn't need it

If the server stays single-node, ZFS is almost certainly the simpler and more performant choice.
