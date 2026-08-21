# traefik

**Purpose:** Traefik management (separate from kube-system).

**What it does:** Contains administrative components for the Traefik ingress controller: Helm release resources, configmaps, and monitoring dashboards. The actual Traefik pods run in `kube-system`. This namespace orchestrates updates, stores custom middleware definitions, and exposes management UIs. It keeps operational control separate from the runtime plane.
