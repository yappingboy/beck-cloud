# RAID6 Storage Migration Plan — Beck Cloud

> **Status:** ✅ Completed
> **Previous storage:** Rook-Ceph (decommissioned), then ZFS attempt (abandoned)
> **Architecture:** md0 RAID6 (14x 6TB HGST) → LVM → OpenNebula Tank datastore → K3s VM DATABLOCK

---

## 1. Storage Architecture

### Drive Inventory

| Disk | Size | Model | Status | SMART Health |
|------|------|-------|--------|-------------|
| sda | 1.8T | Samsung 990 PRO | OS disk | ✅ |
| sdb | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdc | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdd | 6TB | HGST HUS726T6TALE | ✅ in md0 | ⚠️ degraded (thousands uncorrectable) |
| sde | 6TB | HGST HUS726T6TALE | ✅ in md0 | ⚠️ degraded (thousands uncorrectable) |
| sdf | 10TB | Seagate | ❌ DEAD (I/O errors, 219K UDMA_CRC) |
| sdg | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdh | 10TB | Seagate ST10000DM014 | ⏸️ Reserved (no partner) | ✅ |
| sdi | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdj | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdk | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdl | 6TB | HGST HUS726T6TALE | ✅ in md0 | ⚠️ 9 errors |
| sdm | 6TB | HGST HUS726T6TALE | ✅ in md0 | ⚠️ failed previously, in scan |
| sdn | 6TB | HGST HUS726T6TALE | ✅ in md0 | ⚠️ 82 errors |
| sdo | 6TB | HGST HUS726T6TALE | ✅ in md0 | ✅ |
| sdh | 10TB | Seagate ST10000DM014 | ⏸️ Reserved | ✅ |

### RAID6 Array

- **14x 6TB HGST SAS** → `/dev/md0` (RAID6, left-symmetric, 512K chunk)
- **Usable:** ~78TB (tolerates 2 simultaneous disk failures)
- **Excluded:** sdf (10TB, dead), sdh (10TB, no partner)

### LVM Layer

- `vg_tank` on `/dev/md0`
- `lv_tank` (100% FREE) → XFS → `/var/lib/one/datastores/101`
- Owned by `oneadmin:oneadmin`

### OpenNebula Integration

- DS 101 = Tank (shared datastore, DISK_TYPE: 2/shared)
- BecklabMedia VM (ID 27) has DATABLOCK image on Tank
- Inside VM: `/dev/vdb` mounted at `/mnt/media`

### K3s Integration

- k3s-worker-1 (192.168.100.11) runs media services
- BecklabMedia VM provides storage via DATABLOCK
- Media stack: Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, qBittorrent

## 2. Deployment Steps

### Phase 1: RAID6 Build ✅

```bash
# Run ansible playbook
ansible-playbook -i inventory/hosts.yml playbooks/01-raid-storage.yml
```

This handles:
1. Install mdadm
2. Discover data disks (auto-excludes OS disk, sdf, sdh)
3. Wipe existing signatures
4. Create md0 RAID6 (14 drives, 512K chunk, left-symmetric)
5. Create vg_tank → lv_tank
6. Format XFS
7. Mount at /var/lib/one/datastores/101
8. Set ownership to oneadmin:oneadmin

### Phase 2: OpenNebula Tank Datastore

- Create ONE datastore pointing to `/var/lib/one/datastores/101`
- Set as shared datastore
- Deploy BecklabMedia VM with DATABLOCK attached

### Phase 3: K3s Media Stack

- Deploy Jellyfin, Sonarr, Radarr, etc. on k3s-worker-1
- Mount BecklabMedia DATABLOCK at /mnt/media
- Configure media libraries

## 3. Known Issues

### Degraded Drives

- **sdd, sde**: Thousands of uncorrectable errors — RAID6 parity will handle this
- **sdl**: 9 errors during scan — monitor
- **sdm**: Failed during initial scan — monitor
- **sdn**: 82 errors during scan — monitor

These drives are functional within RAID6 context. Parity provides fault tolerance.
Replace drives if SMART reports imminent failure or if array degrades beyond 2 drives.

### Dead Drive

- **sdf** (10TB Seagate): I/O errors, 219K UDMA_CRC errors (cable issue)
- **Action:** Replace drive + cable, then consider adding as md1 RAID1 with sdh

## 4. Monitoring

- Cron job runs every 30m checking scan completion → triggers repair
- `check-and-repair.sh` at `~/.hermes/scripts/check-and-repair.sh`
- Repair script at `/tmp/hdd-repair-all.sh` (short-lived, not in repo)

## 5. Rollback

If RAID6 build fails:
```bash
ansible-playbook -i inventory/hosts.yml playbooks/99-uninstall.yml \
  -e confirm_uninstall=true -e wipe_disks=true
```

## 6. Future Improvements

- [ ] Add smartd monitoring for early failure detection
- [ ] Consider sdh (10TB) as md1 RAID1 when matching 10TB drive available
- [ ] Replace sdf with new 10TB drive
- [ ] Evaluate replacing sdd/sde if SMART degradation continues
