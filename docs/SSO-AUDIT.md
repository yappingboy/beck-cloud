# SSO Auto-Auth Audit — BeckCloud Services

## Architecture Overview

BeckCloud uses a **Keycloak → oauth2-proxy → Traefik forwardAuth** pattern:

```
Browser → Traefik → [oauth2-proxy forwardAuth] → Service
                 ↑ (cookie check + X-Auth-Request-* headers)
              Keycloak OIDC (token issuance)
```

**Two oauth2-proxy instances:**
- **oauth2-proxy (admin)**: `oauth2.becklab.cloud` — cookie `_oauth2_admin`, allowed groups `/admins`
- **oauth2-proxy-media (media)**: `oauth2-media.becklab.cloud` — cookie `_oauth2_media`, allowed groups `/admins`, `/media`

**Two SSO middleware chains:**
- **sso-admin-chain**: `oauth2-redirect-admin` + `keycloak-forwardauth-admin` — forwards `Authorization` header
- **sso-media-chain**: `oauth2-redirect-media` + `keycloak-forwardauth-media` — forwards `Authorization` header
- **sso-admin-chain-no-auth-header**: same as admin but strips `Authorization` (for HA's self-auth)

**SSO redirect pages:** nginx pod (`sso-redirect`) serves login redirect pages based on path (admin vs media).

---

## Complete Service Inventory

### ✅ Already SSO-Protected

| Service | SSO Chain | Config Method | Notes |
|---------|-----------|---------------|-------|
| **Grafana** | admin | IngressRoute middleware | auth.proxy enabled. Auto_sign_up. Disable_login_form |
| **Prometheus** | admin | Ingress annotation | |
| **Alertmanager** | admin | Ingress annotation | |
| **Hubble UI** | admin | IngressRoute middleware | Cilium network observability |
| **OpenNebula** | admin | IngressRoute middleware | External endpoint (172.16.0.7:2616) |
| **Affine** | admin | IngressRoute middleware | Collaborative wiki |
| **Home Assistant** | admin-no-auth-header | IngressRoute middleware | Special: no Authorization forwarded (HA has its own auth) |
| **OpenClaw (nova)** | admin | IngressRoute middleware | AI assistant gateway |
| **Silex** | admin | IngressRoute middleware | Design tool |
| **Radarr** | admin | Ingress annotation | Movies |
| **Sonarr** | admin | Ingress annotation | TV shows |
| **Prowlarr** | admin | Ingress annotation | Indexer manager |
| **Bazarr** | admin | Ingress annotation | Subtitles |
| **SABnzbd** | admin | Ingress annotation | NZB downloader |
| **NZBGet** | admin | Ingress annotation | NZB downloader |
| **qBittorrent** | admin | Ingress annotation | Torrents (via Gluetun) |
| **Homebox** | admin | Ingress annotation | Home inventory |
| **Jellyseerr** | media | Ingress annotation | Media requests |
| **Tdarr** | media | Ingress annotation | Media transcoding |
| **Swiparr** | media | Ingress annotation | Jellyfin filter |
| **Manyfold** | admin | Ingress annotation | 3D model library |
| **Spoolman** | admin | Ingress annotation | Filament tracker |
| **FDM Monster** | admin | Ingress annotation | 3D print farm manager |
| **Keycloak** | (own) | Direct | SSO identity provider |
| **User Invite** | (own) | Direct | User provisioning |
| **Landing Page** | (own) | Direct | Public site |
| **Homepage** | (own) | Direct | Service dashboard |
| **Bitwarden BSM** | (own) | Direct | Password manager (self-auth) |
| **Directus** | (own) | Direct | CMS (self-auth, admin role) |
| **Keycloak** | (own) | Direct | SSO IdP |
| **Landing Page** | (own) | Direct | Public site |
| **Homepage** | (own) | Direct | Service dashboard |

### ❌ Missing SSO — NEEDS CONFIGURATION

| Service | Domain | Category | Required Chain | Config Method |
|---------|--------|----------|----------------|---------------|
| **Jellyfin** | jellyfin.becklab.cloud | media | sso-media-chain | Ingress annotation (add middleware) |
| **Auth Service** | auth.tools.becklab.cloud | tools/admin | sso-admin-chain | IngressRoute middleware |
| **BeckFlow** | dashboard.tools.becklab.cloud | tools/admin | sso-admin-chain | IngressRoute middleware |
| **Image Editor (frontend)** | editor.tools.becklab.cloud | tools/admin | sso-admin-chain | IngressRoute middleware |
| **OrcaSlicer** | slicer.becklab.cloud | 3dprinting/admin | sso-admin-chain | IngressRoute middleware |
| **BumpMesh** | bump.becklab.cloud | 3dprinting/public | none | Public (mesh tool) |
| **Spotweb** | spotweb.becklab.cloud | media | sso-admin-chain | IngressRoute middleware |
| **Kiri:Moto** | kiri.becklab.cloud | gridspace/public | none | Public (3D slicer) |
| **Mesh:Tool** | mesh.becklab.cloud | gridspace/public | none | Public (mesh repair) |
| **Void:Form** | void.becklab.cloud | gridspace/public | none | Public (generative design) |
| **LLDAP** | lldap.becklab.cloud | identity/public | none | Public (LDAP admin UI) |
| **Cron Jobs** | cron.tools.becklab.cloud | tools/admin | sso-admin-chain | IngressRoute middleware |
| **DNS Monitor** | dns.tools.becklab.cloud | tools/admin | sso-admin-chain | IngressRoute middleware |
| **URL Shortener** | short.tools.becklab.cloud | tools/public | none | Public (URL tool) |
| **Webhook Relay** | webhook.tools.becklab.cloud | tools/public | none | Public (webhook tool) |
| **YAML/JSON Tool** | fmt.tools.becklab.cloud | tools/public | none | Public (formatting tool) |
| **Base64 Converter** | convert.tools.becklab.cloud | tools/public | none | Public (encoding tool) |
| **Hash Tool** | hash.tools.becklab.cloud | tools/public | none | Public (hashing tool) |
| **QR Generator** | qr.tools.becklab.cloud | tools/public | none | none | Public (QR tool) |

### ℹ️ Self-Auth Services (No SSO needed)

| Service | Domain | Reason |
|---------|--------|--------|
| **Keycloak** | keycloak.becklab.cloud | SSO identity provider itself |
| **Bitwarden BSM** | bw.becklab.cloud | Password manager (native auth) |
| **Directus** | cms.becklab.cloud | CMS (native auth, admin role) |
| **User Invite** | invite.becklab.cloud | Public signup form |
| **Landing Page** | becklab.cloud | Public marketing site |
| **Homepage** | home.becklab.cloud | Service dashboard (public) |
| **Kiri:Moto** | kiri.becklab.cloud | Public 3D slicer tool |
| **Mesh:Tool** | mesh.becklab.cloud | Public mesh repair tool |
| **Void:Form** | void.becklab.cloud | Public generative design tool |
| **BumpMesh** | bump.becklab.cloud | Public mesh repair tool |
| **URL Shortener** | short.tools.becklab.cloud | Public URL tool |
| **Webhook Relay** | webhook.tools.becklab.cloud | Public webhook tool |
| **YAML/JSON Tool** | fmt.tools.becklab.cloud | Public formatting tool |
| **Base64 Converter** | convert.tools.becklab.cloud | Public encoding tool |
| **Hash Tool** | hash.tools.becklab.cloud | Public hashing tool |
| **QR Generator** | qr.tools.becklab.cloud | Public QR tool |
| **LLDAP** | lldap.becklab.cloud | LDAP admin UI (public, no users) |

---

## Files to Create/Modify

### 1. New SSO middleware for Spotweb and other media services

**File:** `beck-cloud/flux/infrastructure/identity/sso-middlewares.yaml`
- Add `sso-media-chain` for Spotweb (already exists, verify)
- Ensure both chains forward proper auth headers

### 2. Tools (micro) SSO ingress updates

**Files:** `beck-cloud/flux/infrastructure/micro/services/*/ingress.yaml`
- Add SSO middleware to admin tools: auth-service, beckflow, cron-jobs, dns-monitor, image-editor
- Remove SSO from public tools (already none)

### 3. 3D Printing SSO ingress updates

**File:** `beck-cloud/flux/infrastructure/3dprinting/ingressroutes.yaml`
- Add `sso-admin-chain` to manyfold, spoolman, fdmmonster ingress routes
- Leave bumpmesh public (no middleware)
- OrcaSlicer already has middleware annotation, verify chain

### 4. Media SSO ingress updates

**File:** `beck-cloud/flux/infrastructure/media/jellyfin.yaml`
- Add `sso-media-chain` middleware annotation
- **Already SSO-protected:** radarr, sonarr, prowlarr, bazarr, sabnzbd, nzbget, qbit-gluetun, homebox, jellyseerr, tdarr, swiparr, spotweb (all already have chains)

### 5. Griddspace SSO ingress updates

**File:** `beck-cloud/flux/infrastructure/gridspace/ingressroutes.yaml`
- Kiri:Moto, Mesh:Tool, Void:Form remain public (no middleware)

### 6. Documentation file

**File:** `beck-cloud/flux/infrastructure/identity/SSO-AUDIT.md` (this file)

---

## Implementation Notes

1. **Traefik 3.x uses `@kubernetescrd` suffix** for middleware references in annotations:
   - Old format: `identity/sso-admin-chain`
   - New format: `identity-sso-admin-chain@kubernetescrd`

2. **OAuth2-proxy forwardAuth** passes these headers to upstream:
   - `X-Auth-Request-User` — username
   - `X-Auth-Request-Email` — email
   - `X-Auth-Request-Access-Token` — JWT bearer token
   - `X-Auth-Request-Groups` — user groups
   - `Authorization` — Bearer token (in admin chain)

3. **Grafana's `auth.proxy`** reads `X-Auth-Request-Email` header and auto-creates users.
   This is the only service that consumes the auth header directly.

4. **Other services** trust the oauth2-proxy authentication and don't validate headers themselves.
   The forwardAuth middleware only returns 401 if the user isn't authenticated,
   so the upstream service never sees the auth response.

5. **SSO Redirect Pages** — nginx pod serves `admin-index.html` and `media-index.html`
   based on which chain triggers the errors middleware. Each redirect page sends the
   user to the correct oauth2-proxy start URL.
