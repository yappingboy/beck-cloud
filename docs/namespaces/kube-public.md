# kube-public

**Purpose:** Cluster-wide shared information.

**What it does:** A read-only namespace where the Kubernetes API server writes cluster-scoped data that any user can access — typically the `cluster-info` configmap containing bootstrap tokens, node authorization data, and other public cluster metadata. No applications run here; it is purely informational.
