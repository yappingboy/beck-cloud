# kube-public

**Purpose:** Cluster-wide shared information.

**What it does:** A read-only namespace where the Kubernetes API server writes cluster-scoped data. Any user can access it. It typically contains the `cluster-info` configmap with bootstrap tokens, node authorization data, and public cluster metadata. No applications run here.
