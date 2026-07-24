# BeckCloud RBAC Design

> Fine-grained access control on top of Keycloak/LLDAP.

## Current State

- **Auth chain:** LLDAP → Keycloak → oauth2-proxy → Traefik forwardAuth
- **Two groups:** `/admins` (via LLDAP admin group), `/media` (via LLDAP media group)
- **K8s RBAC:** Only `keycloak:/admins` bound to `cluster-admin`
- **SSO coverage:** 26 services behind oauth2-proxy, 10 public, 5 self-auth
- **Gap:** All SSO-covered services use the same binary check — "is user in /admins or /media?" No per-service granularity.

## Design Goals

1. **Layered access model** — group membership (broad) + service roles (fine-grained)
2. **Keycloak-centric** — roles live in Keycloak, propagated to services via JWT claims
3. **Traefik-enforced** — middleware reads role claims and enforces per-route policies
4. **Audit-capable** — permission changes logged to a centralized store
5. **Backward-compatible** — existing `/admins` and `/media` groups still work as broad role assignments

## Role Model

### Realm Roles (Keycloak)

These are user-level roles assigned in Keycloak's "Realm Roles" section:

| Role | Description | Default Group |
|------|-------------|---------------|
| `beckcloud.admin` | Full admin access to all services | `/admins` |
| `beckcloud.user` | Standard member access | all authenticated |
| `beckcloud.service` | Service-to-service access (machine accounts) | — |
| `beckcloud.auditor` | Read-only access to audit logs + dashboards | — |

### Client Roles (Keycloak)

Each service/client gets its own role set. Example for the `beckcloud-services` client:

| Role | Access Scope |
|------|-------------|
| `service.dashboard` | BeckFlow + service catalog |
| `service.media-view` | Jellyfin, Jellyseerr, Sonarr, Radarr, etc. |
| `service.media-manage` | Media services + upload capability |
| `service.download` | qBittorrent, SABnzbd, nzbget |
| `service.monitor` | Grafana, Prometheus, Alertmanager, Hubble |
| `service.dev` | Auth Service, Cron Jobs, DNS Monitor, Image Editor API, BeckFlow |
| `service.cms` | Directus, Manyfold, Affine |
| `service.security` | Trivy, Velero, Keycloak admin, LLDAP |

### Group-to-Role Mapping

LLDAP groups map to realm roles automatically:

| LLDAP Group | Realm Role |
|-------------|-----------|
| `/admins` | `beckcloud.admin` |
| `/media` | `beckcloud.user` + `service.media-view` |
| `/downloads` | `service.download` |
| `/monitoring` | `service.monitor` |
| `/dev` | `service.dev` |
| `/cms` | `service.cms` |
| `/security` | `service.security` |

Additional users can be assigned client roles directly in Keycloak for fine-grained access without group membership.

## Propagation Chain

```
Keycloak JWT (bearer) → oauth2-proxy (token introspection) → Traefik Headers
```

### oauth2-proxy Configuration

Each oauth2-proxy instance gains an additional middleware that extracts client roles from the JWT and adds them as headers:

- `X-Auth-Request-BeckRoles` — JSON array of client role names
- `X-Auth-Request-BeckRealm` — realm role string

This requires the Keycloak OIDC provider to expose client roles in the JWT. Configured via:
- Keycloak: `Access Type: confidential`, include `clientRoles` in token
- oauth2-proxy: `extraArgs: --claim-scopes=roles` (or custom scope mapping)

### Traefik Middleware Enhancements

New middleware types:

1. **Role-enforcing middleware** — checks if a specific role is present in `X-Auth-Request-BeckRoles`
2. **Exclusion middleware** — denies if a role is present (e.g., deny `service.download` from qBittorrent)

Implementation options:
- **Option A:** Traefik `plugins` — custom Go plugin (e.g., `traefik-role-checker`)
- **Option B:** Nginx-like `auth_request` to a small Go/Node middleware service
- **Option C:** oauth2-proxy `extraArgs: --set-xauthrequest=true` already sets `X-Auth-Request-Groups`; we can add role headers in a lightweight sidecar

**Chosen approach:** Option B — a small Go `role-enforcer` service that:
- Receives the OAuth2 proxy auth request
- Parses the JWT from the Authorization header
- Extracts client roles from the JWT
- Returns 200 with role headers if roles match, 403 if not
- Logs permission checks to a file/Fluentd

This is simpler than a Traefik plugin and doesn't require rebuilding Traefik.

## Audit Logging

Permission changes tracked in Keycloak events:

| Event Type | When Triggered | Log Entry |
|-----------|---------------|-----------|
| `GRANT_CLIENT_ROLE` | Role assigned | User, role, timestamp |
| `UPDATE_CLIENT_ROLE_MAPPING` | Role changed | User, old roles, new roles, timestamp |
| `LOGIN` | Successful auth | User, IP, roles active, timestamp |
| `TOKEN_EXchanged` | Service-to-service | Client, scopes, timestamp |

Keycloak events → Fluent Bit → Loki → Grafana dashboard.

Alternatively, a simpler approach: Keycloak export → a scheduled job that diffs role assignments and writes to a SQLite/Postgres audit table. This is easier for a homelab scale.

**Decision:** Use Keycloak admin events API + a small periodic sync job (cron) that writes to `directus` audit collection. Directus already handles audit trails.

## Admin Panel Integration

The BeckCloud Admin Panel (card `cdfd89c0`) will use Directus as the backend and Keycloak admin REST API as the identity source:

- List users (from LLDAP via LDAP API)
- Show current roles (from Keycloak admin API)
- Assign/revoke roles (Keycloak admin API)
- Service access matrix view (generated from Keycloak client role mappings)
- Permission audit log (from Directus or Keycloak events)

## Implementation Plan

### Phase 1: Keycloak Role Structure
1. Create realm roles in Keycloak (`beckcloud.admin`, `beckcloud.user`, `beckcloud.service`, `beckcloud.auditor`)
2. Create client (`beckcloud-services`) with client roles for each service category
3. Configure OAuth2-proxy to include client roles in tokens
4. Update existing oauth2-proxy instances to request role claims

### Phase 2: Role Enforcement Middleware
1. Deploy `role-enforcer` service (Go, ~200 lines)
2. Deploy as HelmRelease in `identity` namespace
3. Create Traefik middleware definitions for role checking
4. Wire up to existing SSO chains

### Phase 3: Role-Based Ingress Rules
1. Create per-service ingress rules with role-enforcer middleware
2. Define role requirements per service (which roles can access)
3. Migrate existing SSO services to role-enforced chains

### Phase 4: Audit & Admin
1. Keycloak events → audit pipeline
2. Admin panel role management UI
3. Permission matrix documentation

### Phase 5: Testing & Verification
1. Test role assignments per service
2. Verify backward compatibility
3. Update documentation

## Permission Matrix (Target)

| Service | Required Roles | Public | Admin-Only |
|---------|---------------|--------|------------|
| Grafana | `service.monitor` | — | — |
| qBittorrent | `service.download` OR `service.media-view` | — | — |
| Directus | `service.cms` | — | — |
| Jellyfin | `service.media-view` | — | — |
| Affine | `beckcloud.user` | — | — |
| Keycloak Admin | `beckcloud.admin` | — | ✓ |
| Trivy Operator | `service.security` | — | — |
| Tdarr | `service.media-manage` | — | — |
| Homepage | `beckcloud.user` | — | — |
| Budibase (BeckFlow) | `service.dev` | — | — |

## Files to Create/Modify

### New
- `flux/infrastructure/identity/keycloak-roles.yaml` — Keycloak realm/client roles (via Keycloak operator or manifest)
- `flux/infrastructure/identity/role-enforcer/` — role-enforcer HelmRelease + config
- `flux/infrastructure/identity/sso-role-middlewares.yaml` — new Traefik middleware for role checking
- `docs/research/permission-matrix.md` — comprehensive permission matrix

### Modified
- `flux/infrastructure/identity/oauth2-proxy.yaml` — add role claim scopes
- `flux/infrastructure/identity/oauth2-proxy-media.yaml` — add role claim scopes
- Per-service ingress.yaml files — add role-enforcer middleware to existing SSO chains
- `flux/infrastructure/rbac/cluster-roles.yaml` — add service-level role bindings

## Risks & Tradeoffs

- **JWT size:** Adding client roles to JWT can increase token size. Mitigation: only include relevant roles per client scope.
- **oauth2-proxy role extraction:** Default oauth2-proxy doesn't extract client roles into headers. May need `--claim-scopes` or a small middleware to parse JWT directly.
- **Keycloak admin API rate limits:** For role management UI, need a service account with `realm-management` client role.
- **Backward compatibility:** Existing users in `/admins` get `beckcloud.admin` automatically. No manual migration needed.

---

*Draft 1.0 · 2026-07-24 · Nova*
