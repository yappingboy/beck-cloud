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
- **Current theme:** Default kube-prometheus-stack Grafana theme (dark mode built-in but generic)
- **What needs it:** Brand colors (Ember Gold for highlights, Violet Haze for secondary), custom CSS injected via Grafana custom.ini
- **Complexity:** Medium — Grafana's custom CSS is limited but doable. Color overrides for panels, nav, sidebar.

#### 2. Directus (`cms.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Directus default admin (white-ish by default)
- **What needs it:** Brand colors, custom panel styling
- **Complexity:** Medium-High — Directus supports custom themes via CSS injection and admin overrides. Would need to create a Directus theme package.

#### 3. Traefik Dashboard (`traefik.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Default Traefik dashboard (very bare-bones)
- **What needs it:** Custom CSS for dashboard panels
- **Complexity:** Low — Traefik dashboard accepts custom CSS via middleware `headers.customResponseHeaders: "X-Frame-Options: DENY"` and static config overrides.

#### 4. OpenNebula Sunstone (`one.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Default Sunstone (legacy HTML/CSS)
- **What needs it:** Brand colors, sidebar, nav
- **Complexity:** High — Sunstone's theming is less flexible, relies on LESS variables and static CSS files.

#### 5. Affine (`affine.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Default Affine (light theme)
- **What needs it:** Brand colors, custom CSS
- **Complexity:** Medium — Affine supports custom CSS via settings.

#### 6. Silex (`silex.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Default Silex
- **What needs it:** Brand colors
- **Complexity:** Medium — Silex has CSS customization options.

#### 7. Hubble UI (`hubble.becklab.cloud`)
- **Auth:** SSO via oauth2-proxy
- **Current theme:** Default Hubble (Cypress dashboard)
- **What needs it:** Brand colors
- **Complexity:** Low — Hubble is a Go template + CSS. Can inject custom CSS.

#### 8. Gridspace Services (3D Printing)
- **Spoolman** (`spoolman.becklab.cloud`): 200 OK — Flask default
- **Manyfold** (`manyfold.becklab.cloud`): 302 redirect (SSO)
- **BumpMesh** (`bumpmesh.becklab.cloud`): 000 (down?)
- **FDM Monster** (`fdmmonster.becklab.cloud`): 000 (down?)
- **OrcaSlicer** (`orcaslicer.becklab.cloud`): 000 (down?)
- **Kiri:Moto** (`kiri-moto.becklab.cloud`): 000 (redirect)
- **Mesh:Tool** (`mesh-tool.becklab.cloud`): 000 (redirect)
- **Void:Form** (`void-form.becklab.cloud`): 000 (redirect)

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

- [ ] Shared design token CSS file (`/shared/design-tokens.css`) in the flux repo
- [ ] Grafana custom theme with brand colors
- [ ] Directus custom admin theme
- [ ] Traefik dashboard CSS customization
- [ ] Hubble UI CSS overrides
- [ ] Affine theme config
- [ ] Silex theme config
- [ ] OpenNebula Sunstone LESS overrides
- [ ] Gridspace services (spoolman, manyfold) CSS
- [ ] Documentation: "How to add a new branded service" runbook

### Technical Notes

- Grafana: Use `grafana.ini` → `custom.css_file` pointing to mounted theme CSS
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
