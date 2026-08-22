# fdmmonster

**Purpose:** FDM Monster — real-time 3D printer monitoring and tracking dashboard.

**What it does:** FDM Monster connects to FDM (Fused Deposition Modeling) 3D printers via their APIs (Prusa, Bambu Lab.) to provide live monitoring of print jobs, including progress, temperature, camera feeds, and estimated time remaining. It aggregates printer status into a single dashboard and stores historical print data locally. The deployment runs the official `fdmmonster/fdm-monster:latest` image with two PVCs for database and media storage.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 1Gi limit |
| PVCs | `fdm-monster-database` (5 GiB), `fdm-monster-media` (5 GiB) |

**Ports:**
- `4000` — FDM Monster web UI (NodePort service, target port `4000`).

**Middleware / Ingress:**
- Ingress: `fdm.becklab.cloud` → Service `fdmmonster` (port 4000). Managed by Traefik with TLS.
- The `PathPrefix(/api)` rule has no middleware. The host-level rule uses `sso-admin-chain` (identity namespace).
- Also accessible directly via NodePort on cluster nodes.

**Environment variables:**
- `TZ` — `America/New_York`

**Notes:** FDM Monster is the primary monitoring tool for the 3D printing fleet. The database PVC holds print history and printer configurations, while the media PVC stores timelapse videos and print thumbnails. The pod runs with `hostNetwork: true` (dnsPolicy `ClusterFirstWithHostNet`). No node pinning is set.
