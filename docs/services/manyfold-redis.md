# manyfold-redis

**Purpose:** Redis (Valkey) cache and job queue backend for Manyfold.

**What it does:** Runs Valkey 8 (the open-source Redis fork, Alpine edition) to provide caching and background job queuing for Manyfold. Manyfold uses Sidekiq for asynchronous tasks like library scanning, thumbnail generation, and model analysis — all of which rely on this Redis instance. Unlike the database, this deployment has no persistent storage; data is ephemeral and rebuilt on restart.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 1 limit |
| RAM | 64Mi request / 512Mi limit |
| PVCs | None (ephemeral) |

**Ports:**
- `6379` — Redis/Valkey protocol (ClusterIP, internal only).

**Middleware / Ingress:**
- None — internal cache/queue service, no external access.

**Environment variables:** None.

**Notes:** No persistence is configured, so restarts clear the cache and any pending Sidekiq jobs. For a production setup, consider adding a PVC or using a managed Redis. The Valkey image is drop-in compatible with Redis clients.
