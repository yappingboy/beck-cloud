# nvidia

**Purpose:** GPU runtime support.

**What it does:** Provides NVIDIA device plugin and driver integration for K3s. The namespace contains the `nvidia-device-plugin` deployment (or equivalent) that registers GPU resources with Kubernetes, enabling pods to request GPU compute via resource limits. This is essential for any workload that needs CUDA-capable hardware — currently used by internal tools and potentially future AI/ML services.
