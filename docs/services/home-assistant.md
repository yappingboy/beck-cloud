# home-assistant

**Purpose:** Smart home management dashboard and API.

**What it does:** Home Assistant (`ghcr.io/home-assistant/home-assistant:stable`) runs as a containerized instance, providing a web UI for controlling IoT devices, automations, and integrations. The pod also runs sidecar containers: Mosquitto (MQTT on 1883, WebSocket on 9001), ESPHome (dashboard on 6052), and Matter Server (5580). External access is at `ha.becklab.cloud` via Traefik. The service stores configuration, user data, and device states on a persistent volume.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit (core container) |
| RAM | 512Mi request / 2Gi limit (core container) |
| PVCs | `home-assistant-config` (5 GiB, local-path) for persistent state |

**Ports:**
- `8123` — Home Assistant HTTP API. Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Route: `ha.becklab.cloud` → Service `home-assistant` (port 8123)
- SSO chain: `sso-admin-chain-no-auth-header` (no Authorization header forwarded; HA has its own auth).
- Subpaths: `/esphome` → ESPHome dashboard, `/mqtt` → Mosquitto WebSocket (both with prefix-strip middlewares).
- `Path(/api/websocket)` is routed with no middleware for the companion app and Lovelace.

**Environment variables:**
- `TZ` (`America/Los_Angeles`), `PYTHONUNBUFFERED` (`1`).
- An init container (busybox) appends an `http:` block with `use_x_forwarded_for` and trusted proxies to `/config/configuration.yaml` if missing.

**Notes:** Home Assistant is primarily used by admins. Users sign in through the SSO admin chain, and HA keeps its own account authentication.