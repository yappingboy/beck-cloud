# user-invite

**Purpose:** User invitation form — admin-only portal for granting new accounts.

**What it does:** `user-invite` is a simple web application that lets BeckCloud administrators send password-reset links or direct account invitations to users. It integrates with LLDAP and Keycloak: when an invite is sent, the service creates the user in LLDAP (if they don't exist) and triggers a password-reset email via the `smtp-relay` service. The UI is minimal — essentially a form where you enter the target email and choose the action.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / none set |
| RAM | 128Mi request / 256Mi limit |
| PVCs | None (ephemeral; data stored in LLDAP and Keycloak) |

**Ports:**
- `80` — HTTP form. Exposed internally; likely routed via Traefik with the SSO admin chain if you want it reachable from outside the cluster.

**Middleware / Ingress:**
- Service selector: `app=user-invite`.
- SSO chain (if exposed): `sso-admin-chain` to require authentication before reaching the form.

**Environment variables (Helm defaults):**
- `LLDAP_URL`, `LDAP_BIND_DN`, `LDAP_PASSWORD` — for creating users.
- `SMTP_RELAY_ENDPOINT` — points to `smtp-relay`.
- Other defaults for branding, redirect URLs, etc.

**Notes:** This is a lightweight admin utility; it doesn't store any persistent data itself, just orchestrates between LLDAP, Keycloak, and the SMTP relay.