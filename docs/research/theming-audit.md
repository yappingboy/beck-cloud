# BeckCloud Unified Theming Audit

> Date: 2026-07-24
> Card: 882611c6-45db-4036-b4c7-8c4b04744f0a — "Unified Theming Across All Services"

## Current State: What's Already Branded

### ✅ Fully Branded (Keycloak Login Theme)
- **Service:** Keycloak login pages (all SSO-authenticated services)
- **Status:** Complete. Custom `beckcloud` theme deployed
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
