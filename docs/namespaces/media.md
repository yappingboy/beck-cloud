# media

**Purpose:** Media stack services.

**What it does:** Hosts the complete Jellyfin-based media ecosystem:
- **Jellyfin** (media server UI + backend)
- **Sonarr** (TV show automation)
- **Radarr** (movie automation)
- **Prowlarr** (aggregator for indexer access)
- **Bazarr** (subtitle management)
- **SABnzbd** and **nzbget** (NZB downloaders)
- **Tdarr** (media transcoding/optimization)
- **Homebox** (media asset tracking)
- **Jellyseerr** (request queue for Jellyfin)

All services are protected by the `sso-media-chain` oauth2-proxy instance. They are currently internal-only — there are no IngressRoutes exposing them directly, so they're accessible only via the admin dashboard at `media.becklab.cloud`.
