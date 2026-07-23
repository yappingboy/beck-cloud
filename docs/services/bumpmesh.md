# bumpmesh

**Purpose:** BumpMesh — browser-based 3D mesh processing and manipulation tool.

**What it does:** BumpMesh is an online tool for editing 3D meshes directly in the browser. It supports operations like adding supports, generating bumps, and modifying STL/OBJ files. The deployment uses an init container (`busybox:latest`) that downloads the BumpMesh frontend from the [MarkusNiewoehner/BumpMesh](https://github.com/MarkusNiewoehner/BumpMesh) GitHub repository on startup, extracting the `index.html`, `style.css`, `logo.png`, `js/`, and `textures/` directories into a shared volume. The main container is a lightweight `nginx:alpine-slim` that serves these static files. This keeps the pod small while always pulling the latest version from GitHub.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 10m request / 1 limit |
| RAM | 32Mi request / 256Mi limit |
| PVCs | `bumpmesh-html` (200 MiB, local-path, node `ip-192-168-100-11`) |

**Ports:**
- `80` — HTTP (ClusterIP, internal only).

**Middleware / Ingress:**
- Ingress: `bump.becklab.cloud` → Service `bumpmesh` (port 80). Managed by Traefik with TLS.

**Environment variables:** None.

**Notes:** The init container fetches from GitHub on every pod restart, so the served version tracks `main`. The PVC is small (200 MiB) since it holds only static frontend assets. No backend logic runs in-cluster — all mesh processing happens client-side in the browser.
