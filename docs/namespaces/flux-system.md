# flux-system

**Purpose:** GitOps control plane.

**What it does:** Houses the Flux CD components that drive all configuration management in BeckCloud. Includes `source-controller` (pulls manifests from the GitHub repo), `kustomize-controller` (applies Kustomize overlays), `helm-controller` (installs/upgrades HelmReleases), and `notification-controller` (alerts on drift or errors). This namespace is the brain of the GitOps pipeline — without it, none of the other namespaces would be reconciled or updated.
