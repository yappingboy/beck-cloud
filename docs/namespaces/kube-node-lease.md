# kube-node-lease

**Purpose:** Node lifecycle management.

**What it does:** A standard Kubernetes system namespace that stores lease objects used by the control plane to manage node membership and scheduling decisions. It has no applications or services — its sole purpose is to hold the Lease resources that K3s uses for cluster membership coordination and taint/toleration enforcement.
