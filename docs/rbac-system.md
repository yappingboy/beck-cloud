# BeckCloud Fine-Grained RBAC System

> Role-Based Access Control on top of Keycloak/LLDAP with Traefik middleware enforcement.

## Architecture

```
Browser → Traefik → [oauth2-proxy forwardAuth] → [role-enforcer plugin] → Service
                ↑                    ↑                      ↑
              Cookie check      JWT validation       Role claim check
```

**Chain:** LLDAP → Keycloak → oauth2-proxy → Traefik forwardAuth → role-enforcer → Service

### Components

| Component | Purpose |
|-----------|---------|
| **LLDAP** | User/group directory (source of truth) |
| **Keycloak** | OIDC provider, role definitions, JWT issuance |
| **oauth2-proxy** | Cookie-based auth, JWT validation, header injection |
| **Traefik** | Ingress routing with middleware chains |
| **role-enforcer** | Go service that validates JWT role claims against per-service policy |
| **audit-sync** | CronJob that syncs Keycloak events to Directus audit collection |

## Role Model

### Realm Roles (Keycloak homelab realm)

| Role | Description | Composite Roles |
|------|-------------|-----------------|
| `beckcloud.admin` | Full admin access to all services | admin, monitor, download, media-view, media-manage, dev, cms, user, security |
| `beckcloud.user` | Standard member (authenticated) | media-view, user |
| `beckcloud.service` | Service-to-service machine accounts | — |
| `beckcloud.auditor` | Read-only access to audit logs + dashboards | monitor, user |

### Client Roles (beckcloud-services client)

| Role | Access Scope |
|------|-------------|
| `admin` | Full admin (all services) |
| `monitor` | Monitoring: Grafana, Prometheus, Alertmanager, Hubble |
| `download` | Download managers: qBittorrent, SABnzbd, NZBGet |
| `media-view` | Media browsing: Jellyfin, Radarr, Sonarr, Prowlarr, Bazarr, Swiparr, Homebox |
| `media-manage` | Media management: Tdarr, Jellyseerr |
| `dev` | Dev tools: Auth Service, BeckFlow, Cron Jobs, DNS Monitor, Image Editor |
| `cms` | Content management: Directus, Manyfold |
| `user` | General authenticated: Homepage |
| `security` | Security tools: Trivy, Velero, Keycloak admin, LLDAP |

### Group → Role Mapping (LLDAP sync)

| LLDAP Group | Realm Role | Client Roles |
|-------------|-----------|-------------|
| `/admins` | `beckcloud.admin` | admin, monitor, download, media-view, media-manage, dev, cms, user, security |
| `/media` | `beckcloud.user` | media-view, user |
| `/downloads` | — | download |
| `/monitoring` | — | monitor |
| `/dev` | — | dev |
| `/cms` | — | cms |
| `/security` | — | security |

## Permission Matrix

### Admin Services

| Service | Domain | Required Role(s) | Public | Chain |
|---------|--------|-----------------|--------|-------|
| Keycloak Admin | keycloak.becklab.cloud | `admin` | — | sso-admin → admin-role-check |
| Traefik | traefik.becklab.cloud | `admin` | — | sso-admin → admin-role-check |
| Silex | silex.becklab.cloud | `admin` | — | sso-admin → admin-role-check |
| OpenNebula | one.becklab.cloud | `admin` | — | sso-admin → admin-role-check |

### Monitoring Services

| Service | Domain | Required Role | Public | Chain |
|---------|--------|--------------|--------|-------|
| Grafana | grafana.becklab.cloud | `monitor` | — | sso-media → monitor-role-check |
| Prometheus | prometheus.becklab.cloud | `monitor` | — | sso-media → monitor-role-check |
| Alertmanager | alertmanager.becklab.cloud | `monitor` | — | sso-media → monitor-role-check |
| Hubble | hubble.becklab.cloud | `monitor` | — | sso-media → monitor-role-check |

### Media Services

| Service | Domain | Required Role | Chain |
|---------|--------|--------------|-------|
| Jellyfin | jellyfin.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Jellyseerr | requests.becklab.cloud | `media-manage` | sso-media → media-manage-role-check |
| Radarr | radarr.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Sonarr | sonarr.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Prowlarr | prowlarr.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Bazarr | bazarr.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Swiparr | swiparr.becklab.cloud | `media-view` | sso-media → media-view-role-check |
| Homebox | homebox.becklab.cloud | `media-view` | sso-admin → media-view-role-check |
| Tdarr | tdarr.becklab.cloud | `media-manage` | sso-media → media-manage-role-check |

### Download Services

| Service | Domain | Required Role | Chain |
|---------|--------|--------------|-------|
| qBittorrent | qbit.becklab.cloud | `download` OR `media-view` | sso-admin → qbit-anyrole-check |
| SABnzbd | sabnzbd.becklab.cloud | `download` | sso-admin → download-role-check |
| NZBGet | nzbget.becklab.cloud | `download` | sso-admin → nzbget-role-check |

### Dev Services

| Service | Domain | Required Role | Chain |
|---------|--------|--------------|-------|
| Auth Service | auth.tools.becklab.cloud | `dev` | sso-admin → dev-role-check |
| BeckFlow | dashboard.tools.becklab.cloud | `dev` | sso-admin → dev-role-check |
| Cron Jobs | cron.tools.becklab.cloud | `dev` | sso-admin → dev-role-check |
| DNS Monitor | dns.tools.becklab.cloud | `dev` | sso-admin → dev-role-check |
| Image Editor | editor.tools.becklab.cloud | `dev` | sso-admin → dev-role-check |

### CMS Services

| Service | Domain | Required Role | Chain |
|---------|--------|--------------|-------|
| Directus | cms.becklab.cloud | `cms` | sso-admin → cms-role-check |
| Manyfold | manyfold.becklab.cloud | `cms` | sso-admin → cms-role-check |
| Affine | affine.becklab.cloud | `cms` OR `user` | sso-admin → (cms,user)-role-check |

### General Services

| Service | Domain | Required Role | Public |
|---------|--------|--------------|--------|
| Homepage | home.becklab.cloud | `user` | — |
| Bitwarden | bw.becklab.cloud | — (self-auth) | ✓ |

### Public Services (No Auth Required)

| Service | Domain |
|---------|--------|
| Kiri:Moto | kiri.becklab.cloud |
| Mesh:Tool | mesh.becklab.cloud |
| Void:Form | void.becklab.cloud |
| BumpMesh | bump.becklab.cloud |
| URL Shortener | short.tools.becklab.cloud |
| Webhook Relay | webhook.tools.becklab.cloud |
| YAML/JSON Tool | fmt.tools.becklab.cloud |
| Base64 Converter | convert.tools.becklab.cloud |
| Hash Tool | hash.tools.becklab.cloud |
| QR Generator | qr.tools.becklab.cloud |

## JWT Claim Structure

After implementation, the JWT will contain:

```json
{
  "sub": "uuid",
  "preferred_username": "yappingboy",
  "email": "user@example.com",
  "groups": ["/admins", "/media"],
  "realm_access": {
    "roles": ["beckcloud.admin", "default-roles-homelab"]
  },
  "resource_access": {
    "beckcloud-services": {
      "roles": ["admin", "monitor", "download", "media-view", "media-manage", "dev", "cms", "user"]
    }
  }
}
```

## Policy Enforcement

### Role Enforcer Service

The role-enforcer is a lightweight Go service deployed in the `identity` namespace. It:

1. Receives `POST /check` requests from Traefik's forwardAuth middleware
2. Extracts the JWT from the `Authorization` header
3. Validates the JWT against Keycloak's JWKS endpoint
4. Checks required roles from the per-service policy ConfigMap
5. Returns `200 OK` with role headers (X-Beck-Roles) or `403 Forbidden`

**Configuration:**
- Policy: `/etc/role-enforcer/policy.yaml` (ConfigMap)
- JWKS URL: `https://keycloak.becklab.cloud/realms/homelab/protocol/openid-connect/certs`
- Realm: `homelab`
- Client ID: `beckcloud-services`

**Health endpoint:** `GET /health` → `{"status": "ok"}`
**Reload endpoint:** `POST /reload` → re-reads policy file

### Traefik Middleware Chains

Each service gets a middleware chain that combines:
1. `oauth2-redirect-*` — Redirect to login page if no cookie
2. `keycloak-forwardauth-*` — Validate cookie via oauth2-proxy
3. `<service>-role-check` — Validate JWT roles via role-enforcer

Chains are defined in `flux/infrastructure/identity/sso-role-middlewares.yaml`.

## Audit Logging

### Keycloak Events

| Event | Trigger | Stored In |
|-------|---------|-----------|
| `GRANT_CLIENT_ROLE` | Role assigned | Keycloak → audit-sync → Directus |
| `REMOVE_CLIENT_ROLE` | Role revoked | Keycloak → audit-sync → Directus |
| `UPDATE_ROLE_MAPPING` | Role mapping changed | Keycloak → audit-sync → Directus |
| `LOGIN` | Successful auth | Keycloak → audit-sync → Directus |
| `TOKEN_EXCHANGE` | Service-to-service | Keycloak → audit-sync → Directus |

### Sync Pipeline

The `audit-sync` CronJob (runs every 5 minutes):
1. Polls Keycloak admin events API with cursor-based pagination
2. Maps Keycloak event types to BeckCloud audit categories
3. Writes structured entries to Directus `rbac_audit_log` collection
4. Tracks cursor in a ConfigMap to avoid reprocessing

### Directus Audit Collection Schema

```json
{
  "id": "auto",
  "event_type": "string (GRANT_CLIENT_ROLE, LOGIN, etc.)",
  "action": "string (role_assigned, role_revoked, login, etc.)",
  "user_id": "string (Keycloak user UUID)",
  "ip_address": "string",
  "role": "string (role name)",
  "details": "json (full Keycloak event details)",
  "keycloak_timestamp": "number (epoch ms)",
  "synced_at": "number (epoch seconds)"
}
```

## Admin Tools

The BeckCloud Admin Panel (card `cdfd89c0`) uses Directus as the backend and Keycloak admin REST API as the identity source:

- List users (from LLDAP via LDAP API)
- Show current roles (from Keycloak admin API)
- Assign/revoke roles (Keycloak admin API)
- Service access matrix view (generated from Keycloak client role mappings)
- Permission audit log (from Directus rbac_audit_log collection)

### Role Provisioning

Run `scripts/keycloak-role-provision.sh` to create all realm roles, client roles, and composite mappings:

```bash
export KEYCLOAK_ADMIN_PASSWORD=***
export KC_ADMIN_URL=https://keycloak.becklab.cloud/admin
./scripts/keycloak-role-provision.sh
```

## Deployment Checklist

1. [x] Role-enforcer Go service source code (`beck-cloud/role-enforcer/`)
2. [x] Role-enforcer Flux manifest (`flux/identity/role-enforcer/`)
3. [x] Role-enforcer namespace added to identity kustomization
4. [x] Role-enforcer policy ConfigMap with service→role mappings
5. [x] SSO role middleware chains (`sso-role-middlewares.yaml`)
6. [x] Per-service ingress route updates (all media, micro, 3dprinting services)
7. [ ] Build and publish role-enforcer Docker image
8. [ ] Run Keycloak role provisioning script
9. [ ] Verify JWKS endpoint accessibility from role-enforcer
10. [ ] Test role enforcement with non-admin user
11. [ ] Deploy audit-sync CronJob
12. [ ] Create Directus rbac_audit_log collection
13. [ ] Update Grafana dashboards with role metrics
14. [ ] Document for team runbook

## Files

| File | Purpose |
|------|---------|
| `docs/research/rbac-design.md` | Original design document |
| `docs/research/permission-matrix.md` | Full permission matrix (current + target) |
| `docs/rbac-system.md` | This file — complete system reference |
| `flux/infrastructure/identity/role-enforcer/` | Role-enforcer deployment manifests |
| `flux/infrastructure/identity/sso-role-middlewares.yaml` | Traefik role-enforcing middleware chains |
| `flux/infrastructure/identity/audit-sync-cronjob.yaml` | Audit sync CronJob |
| `scripts/keycloak-role-provision.sh` | Keycloak role provisioning script |
| `beck-cloud/role-enforcer/` | Go source code for role-enforcer service |
| `flux/infrastructure/rbac/cluster-roles.yaml` | Kubernetes cluster role bindings |

---

*Last updated: 2026-07-26 · Nova*
