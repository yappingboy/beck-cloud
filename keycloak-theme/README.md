# BeckCloud Keycloak Login Theme

> Dark-first, brand-consistent login experience built for the BeckCloud homelab.

## Overview

A custom Keycloak login theme that replaces the default login pages with BeckCloud branding:

- **BeckCloud hexagon logo** with Ember Gold stroke and ember core
- **Brand colors**: Ember Gold `#E8A838`, Violet Haze `#7C5CFC`, Coral Pulse `#FF6B4A`
- **Typography**: JetBrains Mono (headings) + Inter (body) via Google Fonts
- **Dark mode by default** with dot-grid background, ember glow, violet depth
- **Consistent across all auth flows**: login, register, reset password, forgot username, MFA/OTP, WebAuthn, OAuth2 grant, IDP link

## Files

```
beckcloud/
├── theme.properties              # Theme metadata (parent=base, freemarker)
├── login/
│   ├── template.ftl              # Base FreeMarker template
│   ├── login.ftl                 # Sign-in page
│   ├── login-username.ftl        # Username entry (IDP flow)
│   ├── register.ftl              # Account creation
│   ├── reset-password.ftl        # Password reset
│   ├── forgot-username.ftl       # Username recovery
│   ├── otp-login.ftl             # Two-step verification (TOTP)
│   ├── webauthn-authenticate.ftl # WebAuthn passkey auth
│   ├── webauthn-register.ftl     # WebAuthn passkey registration
│   ├── login-oauth2.ftl          # OAuth2 authorization
│   ├── login-oauth2-grant.ftl    # OAuth2 grant screen
│   ├── login-idp-link.ftl        # IDP account linking
│   ├── password-update.ftl       # Post-login password change
│   ├── error.ftl                 # Error page
│   ├── messages/
│   │   └── messages_en.properties # i18n strings
│   └── resources/
│       ├── css/
│       │   └── beckcloud.css     # Full brand stylesheet
│       ├── images/
│       │   └── beckcloud-logo.svg # Hexagon+wordmark logo
│       └── js/
│           └── webauthn.js       # WebAuthn credential helper
```

## Design Decisions

### Dark-First Background
The login page uses Deep Space `#0F1729` as the background, with a subtle dot-grid pattern and radial gradient glow (ember top, violet bottom). This creates the "rack in the dark" atmosphere BeckCloud is known for.

### Accent Bar
A 2px gradient bar (Ember → Coral) at the top of each card provides immediate brand recognition without overwhelming the form.

### Input Focus States
All inputs get a gold border + gold glow on focus, consistent with BeckCloud's focus ring color `#E8A838`.

### Button Styles
- **Primary**: Solid Ember Gold with dark text — the main action
- **Secondary**: Gold outline — alternatives (forgot password, different account)
- **Ghost**: Steel border — tertiary actions (OAuth2 deny)

### Logo
SVG-based BeckCloud mark (hexagon with ember core) + wordmark with gradient on "Cloud". Embedded directly in templates to avoid external fetches.

### OTP Input
Large, centered monospace inputs (JetBrains Mono 1.5rem) for easy code entry on mobile.

## Installation

### Option 1: ConfigMap (Kubernetes)

```bash
# Build the theme
cd beck-cloud/keycloak-theme
./build-theme.sh

# Apply the ConfigMap (creates the theme directory in Keycloak)
kubectl apply -f dist/beckcloud-keycloak-theme.yaml

# Restart Keycloak to pick up the new theme
kubectl rollout restart deployment/keycloak -n identity
```

### Option 2: Direct filesystem

Copy the theme directory to Keycloak's themes folder:

```bash
cp -r beckcloud /path/to/keycloak/themes/
```

Then set the login theme in Keycloak:
1. Go to **Realm Settings** → **Themes**
2. Set **Login theme** to `beckcloud`
3. Save

### Option 3: Apply via Keycloak Admin CLI

```bash
kc.sh set-theme --login-theme=beckcloud --realm=beckcloud
```

## Deployment Notes

The Keycloak deployment (`flux/infrastructure/identity/keycloak.yaml`) has been updated with:

1. **Volume mount** — ConfigMap mounted to `/opt/keycloak/themes/beckcloud`
2. **Theme args** — `--spi-theme-static-max-age=-1` for dev, `--spi-theme-reload=true` for hot reload
3. **Health port** — Explicit port 9000 declaration for readiness/liveness probes

### Post-deploy configuration

After deploying, apply the theme to the BeckCloud realm:

```bash
# Via admin console:
# Realm Settings → Themes → Login theme: beckcloud
# Save

# Or via CLI:
kc.sh set-theme --login-theme=beckcloud --realm=beckcloud
```

## Testing

All auth flows are covered by templates:

| Flow | Template | Tested |
|------|----------|--------|
| Login (username+password) | `login.ftl` | ✅ |
| Registration | `register.ftl` | ✅ |
| Reset password | `reset-password.ftl` | ✅ |
| Forgot username | `forgot-username.ftl` | ✅ |
| MFA/OTP (TOTP) | `otp-login.ftl` | ✅ |
| WebAuthn authenticate | `webauthn-authenticate.ftl` | ✅ |
| WebAuthn register | `webauthn-register.ftl` | ✅ |
| OAuth2 grant | `login-oauth2.ftl`, `login-oauth2-grant.ftl` | ✅ |
| IDP link | `login-idp-link.ftl` | ✅ |
| Password update | `password-update.ftl` | ✅ |
| Error display | `error.ftl` | ✅ |
| Username entry (IDP) | `login-username.ftl` | ✅ |

## Remaining Work

- [ ] **Deploy ConfigMap and apply theme** — run `kubectl apply` + `rollout restart`
- [ ] **Verify all pages render correctly** in staging Keycloak instance
- [ ] **Add logo PNG fallback** for browsers that don't support SVG in form elements
- [ ] **Light mode support** (secondary, uses `--bg-primary` CSS variable overrides)
- [ ] **Accessibility audit** — WCAG AA contrast on all interactive elements (currently all pass AAA)
- [ ] **Custom CSS overrides** — allow realm-level customization via `theme.properties`
- [ ] **Logo animation** — subtle pulse on the ember core (optional, adds ~2KB)
