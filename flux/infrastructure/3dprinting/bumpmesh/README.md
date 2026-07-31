# 3dprinting/bumpmesh

**Purpose:** Browser-based mesh texture displacement tool

**What it does:** Pure client-side app served via nginx:alpine-slim. Files downloaded from GitHub on first boot via initContainer into PVC.

**Services:**
- `bumpmesh` — Deployment (with initContainer), Service, Ingress, PVC
