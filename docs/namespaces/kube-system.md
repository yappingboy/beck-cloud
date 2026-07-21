# kube-system

**Purpose:** Core K3s runtime and ingress.

**What it does:** Contains the foundational services that make the cluster operational:
- **K3s server** itself (the Kubernetes API server, scheduler, controller-manager).
- **Traefik** ingress controller (NodePort 80/443) which routes all external traffic to the `*.becklab.cloud` domains.
- **Cilium** CNI (including its secret mount in `cilium-secrets`) for network policies and overlay networking.
- **local-path provisioner** for dynamic PVC provisioning (used by many workloads).

This namespace is the "engine room" — if it's down, nothing else works.
