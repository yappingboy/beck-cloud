# identity

**Purpose:** SSO, authentication, and identity federation

**What it does:** Core identity services — Keycloak (IdP), LLDAP (LDAP user directory), oauth2-proxy (admin + media tiers), Redis (session store), SSO middlewares, and redirect/logout pages. Also hosts the email subsystem (postfix-relay + MariaDB).

**Special resources:** Redis for session data, PostgreSQL via email sub-namespace, LDAP port 389 for Keycloak federation.

**SSO chains:**
- `sso-admin-chain`: oauth2-redirect → keycloak-forwardauth (requires /admins group in LLDAP)
- `sso-media-chain`: same pattern with separate oauth2-proxy for /media group
