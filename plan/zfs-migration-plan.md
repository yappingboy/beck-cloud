# ZFS + Sunbeam Deployment Plan — Beck Cloud

> **Status:** In progress — fresh deployment on Ubuntu 24.04 LTS (Sunbeam 2024.1 requires noble)
> **Previous storage:** Rook-Ceph (decommissioned)
> **Previous OS:** CentOS Stream 10 (replaced)
> **Architecture:** Sunbeam OpenStack on bare metal → K3s on Nova VMs → ZFS/NFS for persistent storage

---

## 1. Pool Architecture

### Drive Inventory

| Device | Size | Role |
|--------|------|------|
| sda–sdg (7 drives) | 5.5TB each | RAIDZ2 vdev 1 |
| sdj–sdp (6 drives) | 5.5TB each | RAIDZ2 vdev 2 |
| sdi, sdm | 9.1TB each | archive mirror |
| nvme1n1 | 476GB | ZFS SLOG (write log) |
| nvme0n1 | — | OS boot drive |

### Pool Design

**`tank`** — primary data pool (~49.5TB usable)
```bash
zpool create -f tank \
  raidz2 sda sdb sdc sdd sde sdf sdg \
  raidz2 sdj sdk sdl sdn sdo sdp \
  log nvme1n1
```
- vdev1: 7 drives RAIDZ2 → 5 data + 2 parity = **27.5TB usable**
- vdev2: 6 drives RAIDZ2 → 4 data + 2 parity = **22TB usable**
- SLOG on nvme1n1: accelerates sync writes (torrent downloads, DB fsync)
- Fault tolerance: survives **2 simultaneous drive failures per vdev**

**`archive`** — high-capacity long-term storage (~9.1TB usable)
```bash
zpool create -f archive mirror sdi sdm
```
- Mirrored pair: survives 1 drive failure
- Used for: long-term backups, cold data, offsite staging

**Total usable: ~58.6TB** (close to previous 60TB single pool)

### Pool Properties
```bash
zfs set atime=off xattr=sa acltype=posixacl tank
zfs set atime=off xattr=sa acltype=posixacl archive
```

---

## 2. Dataset Layout

| Dataset | recordsize | compression | NFS export | Purpose |
|---------|-----------|-------------|------------|---------|
| `tank/k3s` | 128K | lz4 | yes (rw) | K8s PVs via NFS provisioner |
| `tank/media` | 1M | off | yes (rw) | Media library root |
| `tank/media/library` | 1M | off | — | Processed media files |
| `tank/media/downloads` | 1M | lz4 | — | Download staging |
| `tank/media/configs` | 128K | lz4 | — | Sonarr/Radarr/etc configs |
| `tank/torrent` | 1M | lz4 | — | qBittorrent active downloads |
| `tank/backup` | 128K | lz4 | yes (rw) | Velero backup target (MinIO) |
| `tank/logs` | 128K | lz4 | — | Application logs |
| `archive/longterm` | 1M | lz4 | yes (ro) | Cold storage / offsite staging |

---

## 3. Storage Integration with K3s

K3s runs inside Nova VMs. VMs cannot access ZFS datasets directly, so ZFS
is exported via NFS from the bare metal host and consumed by the NFS subdir
external provisioner inside K3s.

```
Bare metal host
  ├─ ZFS tank pool
  └─ NFS server (nfs-kernel-server)
        ├─ /tank/k3s       → Nova VM: K3s → StorageClass: nfs-k3s (default)
        ├─ /tank/media     → Nova VM: K3s → StorageClass: nfs-media
        ├─ /tank/backup    → Nova VM: K3s → MinIO → Velero
        └─ /archive/...    → Nova VM: K3s → StorageClass: nfs-archive (ro)
```

### StorageClasses

| Class | NFS path | Default | Use for |
|-------|----------|---------|----------|
| `nfs-k3s` | /tank/k3s | **yes** | Identity, Keycloak, databases, configs |
| `nfs-media` | /tank/media | no | Jellyfin, media library PVCs |
| `nfs-bulk` | /tank/torrent | no | qBittorrent, download staging |

### SLOG and Workload Match

The NVMe SLOG on `nvme1n1` accelerates **synchronous writes**. This directly
benefits:
- Torrent client (qBittorrent uses `fsync` heavily)
- Database backends (Keycloak/PostgreSQL, lldap)
- NFS with `sync` export option (all exports use `sync`)

Media **streaming** is async sequential read — SLOG has no effect, but the
RAIDZ2 read parallelism across 11 spindles handles it well.

---

## 4. Velero Backup Strategy

With NFS-backed storage, CSI volume snapshots are not available. Velero uses
restic (node-agent) for filesystem-level PV backup instead.

**Backup target options (choose one):**

| Option | Complexity | Offsite | Notes |
|--------|-----------|---------|-------|
| MinIO on tank/backup | Low | No | Self-hosted S3; easy Velero integration |
| Backblaze B2 | Low | Yes | Cheap object storage; native aws plugin |
| AWS S3 | Medium | Yes | Most reliable; costs more |

Recommended path: MinIO on `tank/backup` for primary, rclone to B2 for offsite.

---

## 5. Deployment Sequence

```bash
# 0. Bootstrap Sunbeam OpenStack on bare metal
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/00-sunbeam.yml

# 1. OS hardening, KVM/NFS/ZFS prerequisites
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-os-prep.yml

# 2. Create ZFS pools and NFS exports (add -e wipe_disks=true on first run)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/02-zfs.yml -e wipe_disks=true

# 3. Provision Nova VM instances (K3s nodes)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-nova-vms.yml
# → Update inventory/hosts.yml k3s_nodes IPs with assigned floating IPs

# 4. Install K3s + Cilium on Nova VMs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/04-k3s.yml

# 5. Bootstrap Flux GitOps
GITHUB_TOKEN=<token> ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/05-flux.yml

# 6. Install CSI snapshot CRDs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/06-snapshotter.yml
```

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RAIDZ2 rebuild on 5.5TB drives | ~36-48h degraded pool | `zpool scrub` weekly; never run degraded without alerting |
| NVMe SLOG failure (power loss) | Pool may need `zpool clear` on next import | UPS on host; ZFS recovers safely on clean import |
| NFS as storage backend | Higher latency vs local disk | `hard,intr` mount options; NFS v4.2 for best perf |
| Single node = no live migration | VM failure = downtime | ZFS snapshots + Velero for fast restore |
| Sunbeam 2024.1 on noble (24.04) | Snap channel pinned to LTS | Track 2024.x/stable; check Canonical release notes |
| Nova VM IP changes | K3s cluster loses quorum | Use static IPs via Neutron port allocation |

---

## 7. Static IP Allocation for Nova VMs

To prevent VM IPs from changing across reboots, create fixed Neutron ports
before launching instances:

```bash
. ~/openrc
openstack port create --network k3s-net --fixed-ip subnet=k3s-subnet,ip-address=192.168.100.10 k3s-server-port
openstack port create --network k3s-net --fixed-ip subnet=k3s-subnet,ip-address=192.168.100.11 k3s-worker1-port

# Then launch with --port instead of --network:
openstack server create --port k3s-server-port ... k3s-server
```

---

## 8. Post-Deployment Checklist

- [ ] `zpool status` — all vdevs ONLINE
- [ ] `zpool list` — capacity as expected (~49.5TB tank, ~9.1TB archive)
- [ ] NFS mounts reachable from Nova VMs: `showmount -e 172.16.0.7`
- [ ] K3s nodes all Ready: `kubectl get nodes`
- [ ] NFS provisioner running: `kubectl get pods -n kube-system | grep nfs`
- [ ] Default StorageClass set: `kubectl get sc`
- [ ] Flux reconciling: `flux get all`
- [ ] All HelmReleases healthy: `flux get helmreleases -A`
- [ ] Deploy MinIO on tank/backup, configure Velero storage location
- [ ] Test backup: `velero backup create test-backup --include-namespaces default`
- [ ] Weekly scrub timer active: `systemctl status zfs-scrub.timer`
