# cilium-secrets

**Purpose:** Storage mount for Cilium's secret management.

**What it does:** This namespace hosts no application workloads. Cilium mounts its internal secrets here (cluster identity, encryption keys) via the `cilium-secrets` resource definition. This keeps the core `kube-system` clean and separates stateful secrets from runtime components.

**Note:** No deployments or services run here. It is purely a mount point for Cilium's secret handling.
