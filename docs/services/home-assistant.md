# home-assistant

**Purpose:** Smart home management dashboard and API.

**What it does:** Home Assistant runs as a containerized instance, providing a web UI for controlling IoT devices, automations, and integrations. It exposes its local API on port 8123; external access is via Traefik (typically behind an IngressRoute with SSO protection or direct if configured). The service stores configuration, user data, and device states in a persistent volume.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 512Mi request / 2Gi limit |
| PVCs | `home-assistant-config` (5 GiB, local-path) for persistent state |

**Ports:**
- `8123` — Home Assistant HTTP API. Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Likely protected by the SSO admin chain (depends on Helm config). If no explicit IngressRoute, it's reachable internally via the service name.

**Environment variables (typical):**
- `HASS_CONFIG_DIR` — points to the PVC mount.
- Other defaults for integrations and add-ons.

**Notes:** Home Assistant is primarily used by admins; user access may require authentication depending on how the IngressRoute is configured.