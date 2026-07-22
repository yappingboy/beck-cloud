# lldap

**Purpose:** Lightweight LDAP directory that bridges Keycloak with OpenNebula's LDAP authentication.

**What it does:** LLDAP (v3.14.1) serves as the central identity source for both the SSO system and OpenNebula FireEdge. It stores user accounts, groups, and attributes, then publishes them over LDAP on port 389. Keycloak federates to LLDAP via its built-in LDAP provider; OpenNebula binds using `uid=admin,ou=people,dc=becklab,dc=cloud` to authenticate admins. All users are auto-created in LLDAP on first login (via symlink `/var/lib/one/remotes/auth/default → ldap`).

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit |
| RAM | 128Mi request / 512Mi limit |
| PVCs | `lldap-data` (5 GiB, local-path) for user store |

**Ports:**
- `389` — LDAP (primary auth protocol)
- `17170` — HTTP management interface (`lldap.becklab.cloud`)

**Key environment variables:**
- `LLDAP_DATABASE_URL=sqlite:///data/users.db?mode=rwc` — SQLite-backed user store
- `LLDAP_HTTP_URL=https://lldap.becklab.cloud`
- `LLDAP_LDAP_BASE_DN=dc=becklab,dc=cloud`
- `LLDAP_KEY_SEED`, `LLDAP_JWT_SECRET` — internal auth tokens (secrets)

**Notes:** The admin bind DN is required by OpenNebula; LLDAP does not expose its internal database directly.