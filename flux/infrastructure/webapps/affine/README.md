# webapps/affine

**Purpose:** Collaborative wiki and knowledge base

**What it does:** Affine server for team collaboration, with PostgreSQL database and Redis. Exposed at affine.becklab.cloud with admin SSO.

**Services:**
- `affine` — Affine deployment
- `postgres` — PostgreSQL deployment (Affine database)

**Ports:** PostgreSQL 5432, Affine HTTP (configured in deployment)
