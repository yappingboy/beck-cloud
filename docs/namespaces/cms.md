# cms

**Purpose:** Directus headless CMS deployment.

**What it does:** Hosts the Directus 13.0.2 application, a self-service content management platform used to manage media metadata and other structured content for the BeckCloud. Exposed at `cms.becklab.cloud` with admin SSO via oauth2-proxy. The namespace contains the Directus service and its backing PostgreSQL and Redis instances (labeled as webapp-* services), providing an API-first CMS for user-facing media management and potentially other content workflows.

**Status:** Active — pods present and serving traffic.
