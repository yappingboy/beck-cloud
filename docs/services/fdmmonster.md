# fdmmonster

**Purpose:** FDM Monster — real-time 3D printer monitoring and tracking dashboard.

**What it does:** FDM Monster connects to FDM (Fused Deposition Modeling) 3D printers via their APIs (Prusa, Bambu Lab, etc.) to provide live monitoring of print jobs, including progress, temperature, camera feeds, and estimated time remaining. It aggregates printer status into a single dashboard and stores historical print data locally. The deployment runs the official `fdmmonster/fdm-monster:latest` image with two PVCs for database and media storage.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 1Gi limit |
| PVCs | `fdm-monster-database` (5 GiB, local-path, node `ip-172-16-0-20`), `fdm-monster-media` (5 GiB, local-path, node `ip-172-16-0-20`) |

**Ports:**
- `4000` — FDM Monster web UI (NodePort `30369` → target port `4000`).

**Middleware / Ingress:**
- Ingress: `fdm.becklab.cloud` → Service `fdmmonster` (port 4000). Managed by Traefik with TLS.
- Also accessible directly via NodePort 30369 on cluster nodes.

**Environment variables:**
- `TZ` — `America/New_York`

**Notes:** FDM Monster is the primary monitoring tool for the 3D printing fleet. The database PVC holds print history and printer configurations, while the media PVC stores timelapse videos and print thumbnails. Scheduled to run on the K3s control plane node (`ip-172-16-0-20`).
