# media/recyclarr

**Purpose:** Configuration sync for Radarr/Sonarr/Prowlarr (Recyclarr)

**What it does:** Recyclarr ConfigMap + CronJob for auto-syncing configurations. Requires secret-recyclarr.

**Services:**
- `recyclarr` — ConfigMap, CronJob
- `secret-recyclarr` — Recyclarr secret
