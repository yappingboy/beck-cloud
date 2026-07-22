# bitwarden-secrets-manager

**Purpose:** Vaultwarden (Bitwarden Server Side) — cluster-wide secrets manager.

**What it does:** This service hosts the Bitwarden BSM API (`bw.becklab.cloud`) which stores encrypted secrets for all BeckCloud services. Unlike other apps, BSM is **not** protected by SSO; it uses its own authentication flow (self-service registration) and serves as the central vault for credentials, API keys, and certificates.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 500m limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `bitwarden-data` (10 GiB, local-path) for database and user data |

**Ports:**
- `80` — BSM API (HTTP). Exposed by Traefik with TLS at `https://bw.becklab.cloud`.

**Middleware / Ingress:**
- Route: `bitwarden-secrets-manager` → Service (no SSO middleware; direct access after TLS termination).

**Environment variables (Helm defaults):**
- `BITWARDEN_RS_ADMINS` — list of admin email addresses.
- `BITWARDEN_RS_DB_URL` — points to the internal SQLite/Postgres (in this case likely local file on PVC).
- `BITWARDEN_RS_SERVER_URL` — `https://bw.becklab.cloud`.

**Notes:** All other services reference this BSM via its API to store/retrieve secrets. The BSM itself is a standalone service without Keycloak federation.