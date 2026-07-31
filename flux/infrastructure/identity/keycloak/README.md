# identity/keycloak

**Purpose:** Identity Provider (Keycloak)

**What it does:** Keycloak deployment with StatefulSet (session), Service, and Ingress. Requires secret-keycloak for audit-sync job.

**Services:**
- `keycloak` — Deployment, StatefulSet, Service, Ingress
