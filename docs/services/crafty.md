# crafty

**Purpose:** Crafty Controller — Minecraft server orchestration and world hosting.

**What it does:** Crafty manages multiple Minecraft server instances, handling world generation, player sessions, backups, and plugins. It consists of a main controller pod that coordinates everything, plus sidecar containers for individual server worlds. The service exposes two ports: 8443 (internal management API) and 8123 (RCON for remote administration). Player traffic is routed via the `crafty-minecraft` NodePort service on port 31337 → 25565.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 3 limit |
| RAM | 4Gi request / 8Gi limit |
| PVCs | `crafty-backup` (20 GiB), `crafty-config` (1 GiB), `crafty-import` (20 GiB), `crafty-logs` (5 GiB), `crafty-world` (20 GiB) — all local-path |

**Ports:**
- `8443` — Crafty management API (ClusterIP, internal only).
- `8123` — RCON (used by admins to control servers).
- `25565` → NodePort `31337` — Minecraft gameplay traffic (external access via `crafty-minecraft` service).

**Middleware / Ingress:**
- No external IngressRoute; the NodePort exposes the game directly to the network. Admin tools likely connect internally via 8443/8123.

**Environment variables (Helm defaults):**
- `MINECRAFT_SERVER_JAR` — path to the server JAR inside the PVC.
- `WORLDS_PATH` — mount point for `crafty-world`.
- Backup and logging paths tied to respective PVCs.

**Notes:** Crafty is a fairly heavy service due to the JVM; its resource limits are generous to avoid frequent GC pauses. The world data lives on durable PVCs, so server restarts preserve player progress.