# spoolman-app

**Purpose:** Spoolman — filament spool inventory management and tracking system.

**What it does:** Spoolman tracks 3D printing filament spools — weight, usage, filament type, color, and printer compatibility. It provides a REST API and web UI for managing spool inventory, updating consumed weight after prints, and organizing by filament brand or material. The deployment runs `ghcr.io/donkie/spoolman:latest` with data persisted on a 2 GiB PVC. Note: the Kubernetes service is named `spoolman` (not `spoolman-app`), and the service maps external port 7912 → container target port 8000.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 1 limit |
| RAM | 64Mi request / 512Mi limit |
| PVCs | `spoolman-data` (2 GiB, local-path, node `ip-192-168-100-11`) |

**Ports:**
- `7912` → target port `8000` — Spoolman API and web UI (ClusterIP, internal).

**Middleware / Ingress:**
- Ingress: `spoolman.becklab.cloud` → Service `spoolman` (port 7912). Managed by Traefik with TLS.

**Environment variables:**
- `TZ` — `America/New_York`
- `SPOOLMAN_HOST` — `0.0.0.0`
- `SPOOLMAN_PORT` — `8000`

**Notes:** Spoolman integrates with slicers (OrcaSlicer, PrusaSlicer) and monitoring tools (FDM Monster) to automatically deduct filament weight after completed prints. The 2 GiB data volume stores the SQLite database and any uploaded filament images.
