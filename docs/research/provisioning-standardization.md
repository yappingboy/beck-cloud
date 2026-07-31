# Provisioning Standardization Assessment

**Date:** 2026-07-31
**Author:** Nova

## Current State Analysis

### Deployment vs StatefulSet

| Pattern | Services | Rationale |
|---------|----------|-----------|
| **Deployment** | Sonarr, Radarr, Jellyfin, Bazarr, Prowlarr, NZBGet, SABnzbd, qBittorrent, Jellyseerr, Homebox, Spotweb, Swiparr, Tdarr, LLDAP, Bitwarden, Affine, Crafty, FDMMonster, Spoolman, BumpMesh, Manyfold, Micro Auth, Homepage, Landing Page, User Invite, Logout Page, Spotweb | Stateless apps, single replica, no ordering guarantees needed |
| **StatefulSet** | Redis, Keycloak, Spotweb (DB) | Redis = persistent data with ordered startup; Keycloak = needs stable identity; Spotweb DB = PostgreSQL with PVC |
| **DaemonSet** | Suricata | Network sensor — correct to use DaemonSet |
| **HelmRelease** | cert-manager, cilium, traefik, velero, kube-prometheus-stack, homepage, oauth2-proxy ×2, crowdsec | Complex apps with many components |

**Assessment:** Deployment vs StatefulSet split is reasonable. The only questionable one is Keycloak — it's a StatefulSet but only runs 1 replica with no headless service ordering. A Deployment would work fine. However, the current StatefulSet pattern is defensible.

### IngressRoute vs Ingress

**IngressRoute (Traefik CRD)** — 14 services:
- webapps: affine, openclaw, silex (via landing-page), home-assistant, void-form, mesh-tool, gridspace (kiri/mesh/void), directus, grafana, hubble, crafty-2 (v2)
- identity: sso-redirect, keycloak (via homepage patches)
- monitoring: grafana-ingress, hubble-ingress
- micro: auth-service (3 ingressroutes), micro middlewares
- gaming: crafty-ingress
- 3dprinting: none
- velero: commented out ingressroute

**Ingress (Kubernetes standard)** — 19 services:
- media: sonarr, radarr, jellyfin, bazarr, prowlarr, nzbget, sabnzbd, qbit, jellyseerr, tdarr, homebox, spotweb
- identity: lldap, logout-page
- 3dprinting: fdmmonster, spoolman, bumpmesh, orcaslicer, manyfold
- webapps: landing-page, bitwarden
- gaming: crafty v1
- apps: user-invite

**Assessment:** **Major inconsistency.** The 3dprinting namespace and media namespace both use standard `Ingress` resources, while everything else uses Traefik's `IngressRoute` CRD. This is the single biggest standardization opportunity.

### Middleware Patterns

**Global middleware** — 1 file (`traefik/traefik-app/middlewares.yaml`):
- `security-headers`, `ws-redirect`, `redirect-to-https`

**SSO middlewares** — 1 file (`identity/sso-middlewares/sso-middlewares.yaml`):
- `sso-admin-chain`, `sso-media-chain`, `keycloak-forwardauth-*`, `oauth2-redirect-*`

**Service-local middlewares:**
- `crowdsec/crowdsec-app/bouncer-middleware.yaml` — global WAF bouncer
- `micro/micro-app/middlewares.yaml` — 6 rate-limit middlewares (base64, cron, hash, markdown, resize, short)
- `gridspace/gridspace-app/ingressroutes.yaml` — 3 root-redirect middlewares (kiri, mesh, void)
- `home-assistant/ingress.yaml` — 2 strip-prefix middlewares (esphome, mqtt)
- `webapps/cms/directus.yaml` — 1 middleware (directus)
- `identity/sso-middlewares/sso-middlewares.yaml` — 4 more SSO middlewares

**Assessment:** Middleware patterns are somewhat inconsistent:
1. Some services define middlewares in the same file as their IngressRoute (gridspace, home-assistant)
2. Some services reference middlewares defined globally or in another namespace
3. Rate-limit middlewares are all in one file for the micro service but could be more discoverable
4. No consistent naming convention for middleware chains (some use `chain`, some use `middlewares` directly)

### PVC Patterns

**Centralized PVC definitions** — `media/pvcs/pvcs.yaml`:
- All media PVCs (movies, shows, anime, downloads, torrent, config PVCs) defined in one file
- Static binding via `storageClassName: ""` for LVM-backed PVs
- Dynamic binding via `storageClassName: local-path` for service data

**Per-service PVC definitions:**
- `affine/` — 3 PVCs in dedicated file (postgres, storage, config)
- `bitwarden/` — 1 PVC
- `home-assistant/` — 1 PVC (config)
- `webapps/micro/` — 1 PVC
- `gaming/crafty-controller/` — 5 PVCs
- `3dprinting/pvc.yaml` — 5 PVCs (manyfold-config, manyfold-libraries, fdm-monster-media, fdm-monster-database, spoolman-data)
- `velero/minio/` — 1 PV + 1 PVC

**Assessment:** The centralized `media/pvcs/pvcs.yaml` pattern is good. But it's only used for the media namespace. Other namespaces either:
- Bundle PVCs with the service (3dprinting)
- Have standalone PVC files (bitwarden, home-assistant, micro)
- Mix PVCs in the service YAML (crafty-controller has 5 PVCs in one file with the deployment)

### File Organization Patterns

| Namespace | Pattern | File Count (per service) |
|-----------|---------|-------------------------|
| **media** | One file per service (deployment + service + ingress) | 2 files each |
| **3dprinting** | One file per service + separate PVC file | 2 files each |
| **identity** | One file per service, secrets separate | 2-3 files each |
| **webapps** | Mixed — some single file (cms/directus), some split (affine has 8 files) | 2-8 files each |
| **monitoring** | Ingress separate from app | 2 files each |
| **gaming** | Controller + ingress separate | 2 files each |
| **gridspace** | Apps + ingressroutes in same dir | 4 files |

**Assessment:** The media namespace has the cleanest pattern — one YAML file per service containing Deployment + Service + Ingress. But this only works because media uses standard Ingress resources. The 3dprinting namespace is close but has a separate PVC file.

### Namespace Label Patterns

Inconsistent namespace labels:
- Some use `app.kubernetes.io/name` (3dprinting, micro)
- Some use simple `name` label (most)
- Some use `app.kubernetes.io/part-of: beck-cloud` + `team: personal` (webapps, gridspace)
- No standard `app.kubernetes.io/component` or `app.kubernetes.io/managed-by` labels

## Recommended Standardization

### 1. Ingress Standard: Use IngressRoute Everywhere

**Action:** Convert all standard `Ingress` resources to `IngressRoute` CRDs.

**Why:**
- You're already using Traefik everywhere
- IngressRoute supports Traefik-specific features (middlewares, plugins, entrypoints) more cleanly
- Your SSO chain middleware uses `chain:` which only works with IngressRoute
- 70% of services already use IngressRoute

**Effort:** Medium. Each service needs its Ingress replaced with IngressRoute. Most annotations map directly to IngressRoute spec.

### 2. Deployment Pattern: One YAML File Per Service

**Action:** Adopt the media namespace pattern — one YAML file per service containing Deployment (or StatefulSet), Service, and optional IngressRoute.

**Why:**
- Easiest to read, understand, and maintain
- Mirrors the "one service, one file" philosophy
- Media namespace already does this well

**Effort:** Low-Medium. Many services already follow this. Just consolidate the scattered ones (affine has 8 files, crafty-controller has PVCs mixed in).

### 3. PVC Organization: Centralized PVC Files Per Namespace

**Action:** Create a `pvcs.yaml` file per namespace (like media already does).

**Why:**
- Centralizes storage configuration
- Makes it easy to audit PVC usage
- Separates storage concerns from application logic
- media/pvcs/pvcs.yaml is already a good template

**Effort:** Medium. Move PVCs from service files to namespace-level pvcs.yaml, update service references.

### 4. Namespace Labels: Standardize

**Action:** Add consistent labels to all namespaces:
```yaml
labels:
  app.kubernetes.io/name: <namespace>
  app.kubernetes.io/part-of: beck-cloud
  app.kubernetes.io/managed-by: flux
  team: <team-name or personal>
```

**Why:**
- Consistent labeling across namespaces
- Makes `kubectl` queries predictable
- Follows Kubernetes recommended labels

**Effort:** Low. Just add labels to existing namespace YAMLs.

### 5. Middleware Naming Convention

**Action:** Establish consistent naming:
- Global middlewares: `<prefix>-<feature>` (e.g., `security-headers`, `redirect-to-https`)
- Chain middlewares: `<prefix>-chain` (e.g., `sso-admin-chain`)
- Service-local: `<service>-<feature>` (e.g., `affine-strip-prefix`)

**Why:**
- Makes middleware chains discoverable
- Consistent naming helps debugging

**Effort:** Low. Rename middlewares and update references.

### 6. Certificate Pattern

**Action:** Every externally-facing service should have its own Certificate resource (not just some). Currently media services have TLS in Ingress but no Certificate resources.

**Why:**
- Cert-manager needs Certificate resources to provision secrets
- Without them, media service TLS secrets never get renewed
- Consistent pattern makes TLS management predictable

**Effort:** Medium. Add Certificate resources for all media services and any others missing them.

### 7. HelmRelease vs Manifest Decision

**Action:** Document when to use HelmRelease vs raw manifests:
- **HelmRelease:** Complex apps with many dependencies (monitoring stack, keycloak, traefik, cilium)
- **Raw manifests:** Simple single-container services (sonarr, radarr, lldap, bitwarden)

**Why:**
- Some services could be Helm (like homepage) but are deployed as raw manifests
- Documenting the decision prevents future confusion

**Effort:** Low. Add comments to service files explaining the choice.

## Migration Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Standardize on IngressRoute | Medium | High — eliminates biggest inconsistency |
| **P0** | Add missing Certificate resources | Medium | High — fixes media TLS |
| **P1** | Centralized PVC files per namespace | Medium | Medium — better organization |
| **P1** | Namespace label standardization | Low | Low — cleanliness |
| **P2** | Middleware naming convention | Low | Low — cleanliness |
| **P2** | Document Helm vs manifest decisions | Low | Medium — knowledge transfer |
| **P3** | Consolidate multi-file services | Low | Low — cleanliness |

## Quick Wins (No Downtime)

1. **Add missing labels** to all namespace files
2. **Add Certificate resources** for media services (cert-manager will handle the rest)
3. **Document** the current state in this file

## Bigger Picture

The repo structure already follows a logical namespace-based organization. The main inconsistency is the IngressRoute vs Ingress split, which likely came from:
- Early services (media, 3dprinting) deployed before Traefik CRDs were standard
- Homepage patches using standard Ingress (because patches are generic templates)
- Different developers working on different namespaces at different times

Standardizing on IngressRoute would be a net positive and reduce the mental model from "which format does this service use?" to "it uses IngressRoute."
