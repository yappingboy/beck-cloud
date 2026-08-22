# crafty

**Purpose:** Crafty Controller — Minecraft server orchestration and world hosting.

**What it does:** Crafty (`registry.gitlab.com/crafty-controller/crafty-4:latest`) manages Minecraft server instances, handling world generation, player sessions, backups, and plugins. The controller pod exposes ports 8443 (HTTPS management API), 8123 (Dynmap), and 25565 (Minecraft). Player traffic is routed via the `crafty-minecraft` NodePort service on port 31337 → 25565.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 3 limit |
| RAM | 4Gi request / 8Gi limit |
| PVCs | `crafty-backup` (20 GiB), `crafty-config` (1 GiB), `crafty-import` (20 GiB), `crafty-logs` (5 GiB), `crafty-world` (20 GiB) — all local-path |

**Ports:**
- `8443` — Crafty management API (ClusterIP, internal only).
- `8123` — Dynmap.
- `25565` → NodePort `31337` — Minecraft gameplay traffic (external access via `crafty-minecraft` service).

**Middleware / Ingress:**
- Route: `crafty.becklab.cloud` → Service `crafty` (port 8443, scheme https), TLS secret `crafty-tls`.
- The `crafty-ingress` variant applies the `sso-admin-chain` (identity namespace) middleware. The copy in `crafty-controller` has no middleware.
- No SSO on the NodePort game traffic. The NodePort exposes the game directly to the network.

**Environment variables:**
- `TZ` (`America/New_York`).

**Notes:** Crafty is a fairly heavy service due to the JVM. Its resource limits are generous to avoid frequent GC pauses. The world data lives on durable PVCs, so server restarts preserve player progress.