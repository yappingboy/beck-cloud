# bitwarden-secrets-manager

**Purpose:** Vaultwarden (Bitwarden Server Side) — cluster-wide secrets manager.

**What it does:** This service runs Vaultwarden (`vaultwarden/server:latest`) as a cluster-wide secrets manager at `bw.becklab.cloud`. Unlike other apps, it is **not** protected by SSO. It uses its own authentication flow and serves as the central vault for credentials, API keys, and certificates.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 500m limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `bitwarden-data` (10 GiB, local-path) for database and user data |

**Ports:**
- `80` — BSM API (HTTP). Exposed by Traefik with TLS at `https://bw.becklab.cloud`.

**Middleware / Ingress:**
- Route: `bitwarden-secrets-manager` → Service (no SSO middleware. Direct access after TLS termination).

**Environment variables:**
- `PUID` / `PGID` (`1000`), `TZ` (`America/New_York`).
- Data lives on the `bitwarden-data` PVC mounted at `/data` (SQLite database plus user data).

**Notes:** Other services reference this vault via its API to store and retrieve secrets. The service itself is standalone without Keycloak federation.