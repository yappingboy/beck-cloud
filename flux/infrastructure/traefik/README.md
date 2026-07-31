# traefik

**Purpose:** Ingress controller and reverse proxy

**What it does:** Deploys Traefik v3.4.3 via HelmRelease on NodePort :80/:443. Configures middlewares (auth, rate-limit, buffering) and exposes the Traefik dashboard at traefik.becklab.cloud. Handles TLS termination for all *.becklab.cloud domains.

**Special resources:** None.
