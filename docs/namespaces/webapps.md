# webapps

**Purpose:** User-facing SSO-protected applications.

**What it does:** This namespace hosts all the main web services that end users interact with, each secured by the `sso-admin-chain` (oauth2-redirect → keycloak-forward-auth). Services include:
- **Affine** — collaborative wiki (`affine.becklab.cloud`)
- **Directus** — headless CMS API
- **Homepage** — dashboard landing page
- **Landing page** — external-facing entry point
- **Home Assistant** — smart home interface
- **Silex** — design tool (admin-only)

Support services: dedicated Redis and PostgreSQL instances (e.g., `affine-postgres`, `affine-redis`) that back the data-heavy apps. The namespace also runs Bitwarden Secrets Manager (`bitwarden-secrets-manager`), which stores encrypted secrets for the cluster — it does **not** use SSO and is accessed via its own service endpoint.
