# cilium-secrets

**Purpose:** Storage mount for Cilium's secret management.

**What it does:** This namespace is not home to any application workloads. It serves as a dedicated namespace where Cilium mounts its internal secrets (e.g., cluster identity, encryption keys) via the `cilium-secrets` resource definition. All secret-related data for the CNI is namespaced here to keep the core `kube-system` clean and to align with Cilium's design pattern of separating stateful secrets from runtime components.

**Note:** No deployments or services run here; it is purely a mount point for Cilium's secret handling.
