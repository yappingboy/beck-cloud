# tdarr

**Purpose:** Tdarr — automated transcoding and media optimization suite.

**What it does:** Tdarr processes raw media files (from downloads) to produce optimized copies suitable for streaming on various devices. It runs multiple worker containers (video, audio, image scaling, etc.) that pull from a shared pool and push results back. The service is resource-heavy due to CPU-intensive transcoding tasks.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained (only memory limits set) |
| RAM | 1Gi request / 2Gi limit |
| PVCs | `tdarr-config` (5 GiB, local-path) for database, queue, and processed files |

**Ports:**
- Default Tdarr port is 8265 (HTTP API). Exposed internally.

**Middleware / Ingress:**
- Internal only; no public hostname.

**Environment variables (Helm defaults):**
- `TDARR_CONFIG_ROOT` — PVC mount point.
- `MAX_WORKERS` — number of concurrent transcoding processes.
- Other defaults for quality profiles, etc.

**Notes:** Tdarr is optional but recommended for users with mixed-device playback needs; it automatically queues transcoding jobs from Radarr/Sonarr.