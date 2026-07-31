# media/pvs-lvm

**Purpose:** Static PersistentVolumes backed by LVM

**What it does:** Static PVs for the 140+ TiB LVM disk (/mnt/media on k3s-worker-1). Uses 'local' volume type with node affinity.

**Services:**
- `pvs-lvm` — PersistentVolume definitions
