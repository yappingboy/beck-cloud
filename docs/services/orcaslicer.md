# orcaslicer

**Purpose:** OrcaSlicer — browser-accessible 3D slicing engine for FDM printers.

**What it does:** OrcaSlicer is a fork of PrusaSlicer/BambuStudio that prepares 3D models for printing by generating G-code. This deployment runs the Linuxserver.io containerized version, which exposes OrcaSlicer's graphical interface over VNC/noVNC on port 3001, allowing remote access via a web browser. Configurations, printer profiles, and material presets are persisted on a dedicated PVC.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 4 limit |
| RAM | 2Gi request / 8Gi limit |
| PVCs | `orcaslicer-config` (5 GiB, local-path, node `ip-192-168-100-11`) |

**Ports:**
- `3001` — OrcaSlicer noVNC web UI (ClusterIP, internal). Labeled as `https` in the service.

**Middleware / Ingress:**
- Ingress: `slicer.becklab.cloud` → Service `orcaslicer` (port 3001). Managed by Traefik with TLS.

**Environment variables:**
- `PUID` — `1000`
- `PGID` — `1000`
- `TZ` — `America/New_York`

**Notes:** Heavy resource allocation (4 CPU / 8Gi RAM limits) reflects the compute-intensive nature of slicing operations, especially for large or complex models. Node-locked to `ip-192-168-100-11` (K3s worker) for local storage access.
