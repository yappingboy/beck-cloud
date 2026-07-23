# gridspace

**Purpose:** BeckLab Gridspace — custom web application hosting multiple sub-apps under shared infrastructure.

**What it does:** Gridspace is a custom-built application that serves several distinct web interfaces through a single deployment. Three sub-apps are exposed via separate Traefik IngressRoutes: Kiri Moto (`kiri.becklab.cloud`), Mesh Tool (`mesh.becklab.cloud`), and Void Form (`void.becklab.cloud`). All routes use HTTPS with dedicated TLS secrets and root-redirect middlewares to ensure clean URL access.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 500m request / 2 limit |
| RAM | 1Gi request / 4Gi limit |
| PVCs | `gridspace-data` (2 GiB, local-path, RWO) for application data |

**Ports:**
- `8080` — Application HTTP port (ClusterIP, internal). All three IngressRoutes route to this port.

**Middleware / Ingress:**
| Host | IngressRoute | TLS Secret | Middleware |
|------|-------------|------------|------------|
| `kiri.becklab.cloud` | `kiri-moto` | `kiri-tls` | `gridspace-kiri-root-redirect` |
| `mesh.becklab.cloud` | `mesh-tool` | `mesh-tls` | `gridspace-mesh-root-redirect` |
| `void.becklab.cloud` | `void-form` | `void-tls` | `gridspace-void-root-redirect` |

All entry points use `websecure` (HTTPS only). Each route has its own root-redirect middleware to normalize paths.

**Environment variables:**
- `PUID=1000` — user ID for file ownership.
- `PGID=1000` — group ID for file ownership.
- `TZ=America/Los_Angeles` — application timezone.
- `NODE_ENV=production` — Node.js environment mode.

**Health checks:**
- **Liveness:** `HTTP GET /boot/` — 30s initial delay, 15s period, 1s timeout, 3 failures to kill.
- **Readiness:** `HTTP GET /boot/` — 10s initial delay, 5s period, 1s timeout, 3 failures to unready.

**Node scheduling:** Pinned to `ip-192-168-100-11` via `kubernetes.io/hostname` node selector (worker node with local-path storage).

**Notes:** Managed by Flux (`kustomize.toolkit.fluxcd.io/name=infrastructure`). The deployment has gone through 15 revisions, indicating iterative configuration updates.
