# manyfold

**Purpose:** Manyfold — self-hosted 3D model library and repository management system.

**What it does:** Manyfold organizes, catalogs, and serves 3D model files (STL, OBJ, 3MF, etc.) stored on disk. It provides a web UI for browsing, searching, and previewing models, with support for collections, tags, and metadata extraction. The deployment uses an init container (`alpine:3.21`) to fix filesystem permissions (`chown -R 1000:1000`) on the libraries, tmp, and log directories before the main app starts. It depends on `manyfold-db` (PostgreSQL) for metadata and `manyfold-redis` (Valkey) for caching and background job queuing.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 250m request / 2 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `manyfold-libraries` (50 GiB, local-path, node `ip-192-168-100-11`) |
| EmptyDirs | `app-tmp` (no limit), `app-log` (no limit) |

**Ports:**
- `3214` — Manyfold web UI (ClusterIP, internal).

**Middleware / Ingress:**
- Ingress: `manyfold.becklab.cloud` → Service `manyfold` (port 3214). Managed by Traefik with TLS.

**Environment variables:**
- `RAILS_ENV` — `production`
- `DATABASE_URL` — from secret `manyfold-db-secret-79d6tmgb42` (key: `database-url`)
- `REDIS_URL` — `redis://manyfold-redis.3dprinting.svc.cluster.local:6379`
- `SECRET_KEY_BASE` — `3dprint-manyfold-secret-key-change-me`
- `HOSTNAME` — `manyfold.becklab.cloud`
- `PUID` — `1000`
- `PGID` — `1000`

**Notes:** Node-locked to `ip-192-168-100-11` (K3s worker) to keep the 50 GiB libraries PVC local. The `SECRET_KEY_BASE` is still set to the default placeholder and should be rotated for production use. Background scanning and thumbnail generation rely on Redis for the Sidekiq job queue.
