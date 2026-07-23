# redis

**Purpose:** Redis 7 session store for oauth2-proxy SSO sessions.

**What it does:** Runs as a StatefulSet with 1 replica in the `identity` namespace. Stores session tokens for both oauth2-proxy instances (`oauth2-proxy` for admin tier and `oauth2-proxy-media` for media tier). Both proxy instances connect to the same Redis instance via a shared connection URL from the `redis-secrets` secret. Data persists across restarts via a 1 GiB `local-path` PVC (`data-redis-0`).

**Resources:**
| Type | Details |
|------|---------|
| CPU | 10m request / none set |
| RAM | 64Mi request / 256Mi limit |
| PVCs | `data-redis-0` (1 GiB, local-path, RWO) |

**Ports:**
- `6379` — Redis (internal ClusterIP).

**Key configuration:**
- Starts with `redis-server --requirepass $(REDIS_PASSWORD)`.
- `REDIS_PASSWORD` — from `redis-secrets` secret (shared with oauth2-proxy instances via `OAUTH2_PROXY_REDIS_CONNECTION_URL`).

**Notes:** Deployed via Flux CD Kustomize (`kustomize.toolkit.fluxcd.io/name=infrastructure`). Uses `redis:7-alpine`. This is the single shared session backend — if Redis goes down, all oauth2-proxy sessions become invalid and users will need to re-authenticate.
