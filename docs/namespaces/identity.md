# identity

**Purpose:** SSO and federation infrastructure.

**What it does:** Central authentication provider stack for the entire BeckCloud. Components:
- **Keycloak** (26.0): OpenID/OAuth2 IdP, issuing tokens for all services.
- **LLDAP** (3.14.1): Acts as a bridge between Keycloak and OpenNebula's LDAP — syncs admins group members so that only authorized users can log into the hypervisor.
- **Postfix relay + smtp-relay:** Delivers Keycloak password-reset emails and user-invite notifications.
- **Two oauth2-proxy instances:** `oauth2-proxy` secures admin-only endpoints (the "admin chain"), while `oauth2-proxy-media` protects all media-stack services (Jellyfin, Sonarr, etc.).
- **Postfix-relay service:** Provides SMTP relay for internal mail.

**External access:** `identity` namespace itself is not directly exposed; services are routed via Traefik with SSO middleware chains.
