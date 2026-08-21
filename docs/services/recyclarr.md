# recyclarr

**Purpose:** Recyclarr — quality profile and rename rule sync for Radarr and Sonarr.

**What it does:** Recyclarr applies community quality profiles to Radarr, Sonarr, and Prowlarr. It runs as a CronJob in the `media` namespace. The job runs every 6 hours and syncs profile changes from the configured presets.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / 200m limit |
| RAM | 64Mi request / 128Mi limit |
| Schedule | `0 */6 * * *` (every 6 hours) |

**Image:** `ghcr.io/recyclarr/recyclarr:latest`

**Ports:**
- Internal only. No public hostname. The CronJob runs inside the cluster and talks directly to Radarr and Sonarr.

**Middleware / Ingress:**
- No IngressRoute. No external exposure.

**Secrets:**
- `secret-recyclarr` holds API keys for Radarr, Sonarr, and Prowlarr.

**Notes:** Recyclarr does not store data. It reads profiles, applies them to the arr stack, and exits. The CronJob creates a fresh pod on each run.
