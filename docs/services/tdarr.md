# tdarr

**Purpose:** Tdarr — automated transcoding and media optimization suite.

**What it does:** Tdarr processes raw media files (from downloads) to produce optimized copies suitable for streaming on various devices. It runs multiple worker containers (video, audio, image scaling.) that pull from a shared pool and push results back. The service is resource-heavy due to CPU-intensive transcoding tasks.

**Resources:**
| Type | Details |
|------|---------|
| Image | `ghcr.io/haveagitgat/tdarr:latest`, 1 replica |
| CPU | Unconstrained (only memory limits set) |
| RAM | 1Gi request / 2Gi limit |
| PVCs | `tdarr-config` (5 GiB, local-path) for config and queue. `media-shows`, `media-anime`, `media-movies` (45 TiB each, LVM-backed) for source media |

**Ports:**
- Container `8265` (TCP) — Tdarr web UI/API
- Service `8265` — ClusterIP
- IngressRoute: `tdarr.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-media-chain` (namespace `identity`)
- Internal server port is `8266` (set via `serverPort`)

**Environment variables:**
- `TZ` = `America/New_York`
- `PGID` = `1000` (user id is set via the `PUIG` var in the deployment)
- `serverIP` = `0.0.0.0`, `serverPort` = `8266`, `webUIPort` = `8265`
- `internalNode` = `true`, `inContainer` = `true`
- `ffmpegVersion` = `7`
- `nodeName` = `MyInternalNode`
- `auth` = `false`
- `openBrowser` = `true`
- `maxLogSizeMB` = `10`

**Notes:** Tdarr is optional but recommended for users with mixed-device playback needs. It automatically queues transcoding jobs from Radarr/Sonarr.