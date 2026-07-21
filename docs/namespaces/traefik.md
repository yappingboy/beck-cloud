# traefik

**Purpose:** Traefik management (separate from kube-system).

**What it does:** This namespace contains the administrative components for managing the Traefik ingress controller — typically Helm release resources, configmaps with provider settings, and monitoring dashboards. While the actual Traefik pods run in `kube-system` (the k3s-provisioned instance), this namespace is used to orchestrate updates, store custom middleware definitions, and expose management UIs if needed. It keeps operational control separate from the runtime plane.
