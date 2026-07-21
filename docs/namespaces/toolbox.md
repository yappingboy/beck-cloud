# toolbox

**Purpose:** Container build infrastructure.

**What it does:** Runs Kaniko build pods in an isolated namespace. When users or automation need to produce container images, the build jobs are scheduled here, keeping the rest of the cluster clean. The namespace contains Kaniko agent deployments and any required build-time services (e.g., registry credentials via sealed secrets). Currently active — new images are being built regularly.
