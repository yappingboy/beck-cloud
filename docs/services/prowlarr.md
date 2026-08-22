# prowlarr

**Purpose:** Prowlarr — universal indexer interface for all media services.

**What it does:** Prowlarr aggregates RSS feeds and API endpoints from multiple trackers (NZB, torrent). It provides a unified way for Sonarr, Radarr, nzbget, and SABnzbd to query them. It runs as a lightweight container with minimal resource usage.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/prowlarr:latest`, 1 replica |
| CPU | 100m request / 1 limit |
| RAM | 256Mi request / 1Gi limit |
| PVCs | `prowlarr-config` (5 GiB, local-path) for indexer data |

**Ports:**
- Container `9696` (TCP) — Prowlarr HTTP API
- Service `9696` — ClusterIP
- IngressRoute: `prowlarr.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** All download services (Sonarr, Radarr, nzbget, SABnzbd) depend on Prowlarr for tracker discovery and search.