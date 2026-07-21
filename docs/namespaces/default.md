# default

**Purpose:** Kubernetes default namespace.

**What it does:** Contains only the `kubernetes` service, which exposes the Kubernetes API server internally. This is the standard default namespace in K3s and is not used for any user-facing applications or system components beyond the core control plane. All workloads should be placed in purpose-built namespaces (e.g., `kube-system`, `cert-manager`, etc.) to avoid clutter.
