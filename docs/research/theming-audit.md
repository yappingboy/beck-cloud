# BeckCloud Unified Theming Audit

> Date: 2026-07-24
> Card: 882611c6-45db-4036-b4c7-8c4b04744f0a — "Unified Theming Across All Services"

## Current State: What's Already Branded

### ⚠️ Keycloak Login Theme — spec'd & built, NOT deployed (corrected 2026-11-23)
- **Service:** Keycloak login pages (all SSO-authenticated services)
- **Status:** WRONG IN ORIGINAL AUDIT. Realm `homelab` has `loginTheme: "beckcloud"` set, but the Keycloak pod's `/opt/keycloak/themes/` contains no `beckcloud` directory (providers/ empty, no volume mounted), so Keycloak silently falls back to `keycloak.v2`. Live login HTML confirms: `href="/resources/.../login/keycloak.v2/css/styles.css"`. Theme source + build script exist at `apps-source/keycloak-theme/` (incl. `dist/beckcloud-keycloak-theme.yaml`), never wired into the Deployment.
- **CSS:** `/beck-cloud/keycloak-theme/beckcloud/login/resources/css/beckcloud.css`
- **Features:** Brand colors, fonts (Inter + JetBrains Mono), dark mode, login form styling, OTP inputs, password strength meter, animations
- **Scope:** Affects every service that uses SSO login (Grafana, CMS, Hubble, Traefik, OpenNebula, Affine, Silex)

### ✅ Partially Branded (Public-Facing)
- **Landing page** (`brand/website/`): Full brand CSS + HTML, deployed at `becklab.cloud`
  - `style.css` — full design system, animations, responsive, dark/light mode
  - `services.css` — services directory page with search/filter
- **Bitwarden** (`bw.becklab.cloud`): 200 OK, default Vaultwarden theme (no custom CSS)

### 🟡 Unbranded Services (Needs Work)

#### 1. Grafana (`grafana.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy (Keycloak login already branded ✅)
- **Current theme:** Stock Grafana 11.2.2 dark theme
- **Verdict (2026-11-28): NOT themeable by config.** The `paths.custom_css`
  option was removed upstream in Grafana 11, so the obvious hook does not exist:
  - `grep custom_css /usr/share/grafana/conf/defaults.ini` → no match
  - `strings bin/grafana | grep -ci custom_css` → `0`
  - with `custom_css = /usr/share/grafana/public/beckcloud.css` set in
    `grafana.ini`, the file served fine (`GET /public/beckcloud.css` → `200`,
    678 bytes) but the app shell emitted no `<link>` for it, and
    `/api/admin/settings` reported `paths keys: []`. Grafana ignored the setting.
  - Only supported knob in OSS is `users.default_theme` (light | dark). Real
    white-labelling is an Enterprise feature.
- **What it would take:** proxy-side HTML rewrite to inject the `<link>`. Traefik
  cannot rewrite response bodies, so this needs an added hop (nginx/envoy
  sub_filter). Deliberately not done; the dead `custom_css` wiring was reverted
  so the repo does not lie about having a brand hook.
- **Complexity:** High, for a nav-bar accent. Park unless brand parity is a
  hard requirement.

#### 2. Directus (`cms.becklab.cloud`) — ✅ BRANDED 2026-11-23
- **Hook:** `directus_settings` (project_name / project_color / custom_css), set via the
  official settings API so Directus invalidates its own cache.
- **Verified:** unauthenticated `GET /server/info` returns
  `"project_name":"BeckCloud CMS"`, `"project_color":"#E8A838"`, 500 bytes of custom CSS.
- **Blocker found on the way:** `directus_users` was **empty** - the CMS was never
  bootstrapped, so `node cli.js bootstrap` only ran migrations and no admin existed.
  An admin row was inserted with the app's own argon2 module. Deployment env
  `ADMIN_EMAIL` / `ADMIN_PASSWORD=changeme` is misleading; it should move to SOPS.
- **Gotcha:** `directus_users.id` is `char(36)` PK with **no default**, so the uuid must
  be supplied on insert; there is no `ts_created` column in this schema version.

#### 3. Traefik Dashboard (`traefik.becklab.cloud`) — ⛔ NOT POSSIBLE
- Traefik v3's dashboard is a compiled-in React SPA. There is no static-file override,
  no CSS include, and no env/flag for assets.
- The previous claim here ("accepts custom CSS via
  `headers.customResponseHeaders: X-Frame-Options: DENY`") was nonsense - that header
  sets click-framing policy and has nothing to do with CSS.
- Only route to brand it is proxy-side HTML rewriting. Not worth an extra hop.

#### 4. OpenNebula Sunstone (`one.becklab.cloud`) — ⛔ OUT OF SCOPE
- Not a workload in this cluster. `svc/opennebula-sunstone` is a bare ClusterIP with no
  selector whose endpoint is `172.16.0.7:2616`, an external appliance
  (`kubectl get pods -n opennebula` -> `No resources found`).
- Theming it means editing Sunstone's built LESS/CSS on that host, which is
  hypervisor-side work, not a Flux change.

#### 5. Affine (`affine.becklab.cloud`) — ⛔ NO HOOK
- Container env is only `AFFINE_REVISION`, `AFFINE_SERVER_PORT`, `REDIS_SERVER_HOST`,
  `DATABASE_URL`, `AFFINE_INDEXER_ENABLED`, `AFFINE_SERVER_EXTERNAL_URL`.
- No theme/brand/CSS variable exists, and the earlier "supports custom CSS via settings"
  note was never verified against a running instance.

#### 6. Silex (`silex.becklab.cloud`) — ⛔ NO HOOK
- Env is storage/hosting only (`SILEX_FS_ROOT`, `SILEX_URL`, `STORAGE_CONNECTORS`, ...).
- Silex is a website *editor*; branding its editor chrome is an upstream design concern.

#### 7. Hubble UI (`hubble.becklab.cloud`) — ⛔ NO SUPPORTED HOOK
- Frontend is `quay.io/cilium/hubble-ui:v0.13.1` (nginx + compiled React). The shipped
  nginx config has **no** `include ... conf.d/*.conf`, and the image ships no
  customization dir (`ls /srv/pkg/custom` -> absent).
- The config arrives via ConfigMap `hubble-ui-nginx`, owned by the **cilium HelmRelease**
  (`helm.toolkit.fluxcd.io/name: cilium`). Hand-patching it is drift that the next
  cilium upgrade silently reverts.
- Cilium 1.17.0 exposes `hubble.ui.frontend.extraVolumes` / `extraVolumeMounts`, but with
  no include directive and no template override there is nothing useful to mount.
- `nginx -V` does show `--with-http_sub_module`, so a `sub_filter` injection would work -
  if we owned the config. We don't.

#### 8. Gridspace (own image) — ⚠️ REBUILD REQUIRED
- `apps-source/apps/gridspace/Dockerfile` builds `ghcr.io/yappingboy/becklab-gridspace`,
  so branding is possible but it is an image rebuild + CI run, not a config change.
- The earlier per-hostname list here (spoolman/manyfold/bumpmesh/...) was stale and
  mostly recorded `000` for hosts that do not resolve; do not treat it as a service
  inventory.

---

## Implementation Strategy

### Approach: Shared Design Tokens → Per-Service Injection

Rather than rewriting CSS in every service, create a **shared design token system**:

1. **Design Tokens (CSS Custom Properties)** — Already defined in the brand guide's COLOR.md
2. **Injection Method per service type:**
   - **CSS-capable services** (Grafana, Directus, Hubble): Inject `@import` or custom CSS block
   - **Framework services** (Traefik, Silex): Static config override
   - **Legacy services** (OpenNebula Sunstone): LESS variable overrides

### Priority Order (by usage frequency)

1. **Grafana** — Most-used admin service
2. **Directus** — CMS, frequently edited
3. **Traefik Dashboard** — DevOps daily check
4. **Hubble** — Network monitoring
5. **Affine** — Wiki
6. **Silex** — Design tool
7. **OpenNebula** — VM management (less frequent)
8. **Gridspace** — 3D printing (sporadic)

### Deliverables

- [x] Shared design token CSS file — `docs/brand/brand-tokens.css`
- [x] Directus branded (Ember Gold accent + custom CSS), verified live
- [x] ~~Grafana custom theme~~ — **impossible on Grafana 11**, see §1; wiring reverted
- [ ] Gridspace brand pass — needs an image rebuild (`apps-source/apps/gridspace`)
- [x] ~~Traefik / Hubble / Affine / Silex CSS overrides~~ — **no injection hook exists**
- [x] ~~OpenNebula Sunstone LESS overrides~~ — external appliance, out of cluster scope
- [ ] Runbook: "how to brand a new service" (write once a third branded service exists)

> Original acceptance criterion was "all eight services use the brand palette".
> Verified against the running services on 2026-11-23, six of the eight expose no
> supported way to apply a palette. Re-scope to: brand the services that provide a hook
> (Keycloak, Directus) and keep the tokens file as the contract for future services.

### Technical Notes

- Grafana: **no custom-CSS hook in v11** (see the Grafana section above). Do not
  re-add `paths.custom_css`; it is silently ignored. Use
  `docs/brand/brand-tokens.css` as the palette source for services that *do*
  accept CSS.
- Directus: Create `@directus-extension/theme-custom` or use `DIRECTUS_BRAND_COLOR` env vars + custom CSS via admin settings
- Traefik: Modify `traefik.yaml` dashboard static config, add custom CSS via `--api.dashboard=true` + custom template
- Hubble: Override Hubble's CSS via Traefik `headers` middleware + custom response
- OpenNebula: Edit `/var/lib/one/remotes/ui/sunstone-server/app/` LESS files
- Affine: Set `AFFINE_THEME` env var + custom CSS in settings
- Silex: Custom CSS in Silex settings panel
- Spoolman/Manyfold: Inject CSS via Traefik `addHeaders` middleware with custom `<link>` or `<style>` tag

## 2026-11-23 canary validation: theme is NOT deployable (deploy attempt aborted pre-prod)
Built ConfigMap from `apps-source/keycloak-theme/beckcloud/`, mounted it in a throwaway Keycloak 26 (H2, `start-dev`, zero prod impact), and render-tested. Login page renders branded (200, Ember Gold CSS + logo serve). But:
1. **Error page 500s.** `error.ftl` throws `NullPointerException` (`msg(errorMessage)` when the model key is absent). Every failed auth attempt renders the error page → cluster-wide ugly-error 500s on wrong passwords.
2. **Parent inheritance does not resolve.** `loginTheme=beckcloud` + `parent=base`: pages we don't ship (`logout-confirm.ftl`, `login-reset-password.ftl`) raise `TemplateNotFoundException` although they exist in `base/login`. With `loginTheme=base` the same pages render 200. Missing pages = 500.
3. **8 of 14 page templates have dead filenames** (never rendered, canonical names differ): `reset-password.ftl`→`login-reset-password.ftl`, `password-update.ftl`→`login-update-password.ftl`, `otp-login.ftl`→`login-otp.ftl`, `login-idp-link.ftl`→`login-idp-link-confirm.ftl`, `login-oauth2-grant.ftl`→`login-oauth-grant.ftl`, `login-oauth2.ftl`/`forgot-username.ftl` (flow removed in 26), i.e. forgot-password, OTP, logout-confirm and consent are **unbranded or 500**.
4. **`template.ftl` macro mismatch** (fixed pre-deploy): pages used `<#nested "header">` outside any macro → FreeMarker `ParseException` on login. Also `${login.username}` unguarded → `InvalidReferenceException` on first render. Both fixed in source (`05427c9` follow-up), but the inheritance/dead-name problems remain.

**Remediation options:**
- **A. CSS-only branding (low risk, recommended first):** new minimal theme, `parent=keycloak.v2`, no `.ftl` overrides, brand via `styles=` CSS injection over PatternFly. All 20+ flows keep working; colors/fonts/hero styled.
- **B. Full template theme (high effort):** fix `theme.properties` inheritance, rework `template.ftl` to also export base-compatible `registrationLayout`, rename all pages to canonical names, then re-test every flow in the canary (login, forgot, OTP, WebAuthn, consent, register, logout-confirm, error).

Canary harness (reusable): ConfigMap `items[].path` mount + pod spec approach documented; prod deployment was never modified.

## 2026-11-23 RESOLVED: CSS-only theme (Option A) deployed to production
Theme rebuilt as `parent=keycloak.v2` with **zero .ftl overrides**; branding via
`login/resources/css/beckcloud.css` (Ember Gold `--pf-t--global--color--brand--*` tokens,
gunmetal hero, logo lockup over `#kc-header-wrapper`). Broken template set preserved
under `apps-source/keycloak-theme/_archive-templates/` for a future Option-B rework.
- Wiring: `flux/infrastructure/identity/keycloak/theme-configmap.yaml` (regenerate with
  `apps-source/keycloak-theme/build-theme.sh`) mounted at `/opt/keycloak/themes/beckcloud`
  in the Flux Deployment. Realm `homelab` already had `loginTheme=beckcloud` — mount activates it.
- Canary gate (throwaway KC26, same ConfigMap): login/reset-credentials/error pages 200, assets 200.
- Prod verification (main @ 43ad876, rollout complete): login 200 renders
  `/resources/<v>/login/beckcloud/css/{styles,beckcloud}.css` (v2 fallback refs = 0),
  logo 200 at `.../login/beckcloud/images/beckcloud-logo.svg` (CSS-relative `../images/`),
  failed-login re-render 200 + branded, nova-monitoring token grant still OK.
- Deploy sidequest: Flux `infrastructure` Kustomization was blocked by stale completed
  `velero/minio-make-bucket` Job (immutable `spec.template`); deleted Job, sync unblocked.
