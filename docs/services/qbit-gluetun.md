# qbit-gluetun

**Purpose:** qBittorrent over VPN — private torrent client routed through Gluetun (PIA VPN) for anonymous downloading.

**What it does:** Runs qBittorrent inside a pod with Gluetun as an init container that establishes the VPN tunnel before qBittorrent starts. All torrent traffic is encrypted through Private Internet Access (OpenVPN) to a Stockholm server, ensuring the home IP is never exposed to torrent peers. The WebUI runs on port 8080 for remote management. Downloads land on the shared `media-downloads` volume, which is also used by Sabnzbd, Radarr, and Sonarr for seamless handoff between downloaders and media managers.

**Resources:**
| Type | Details |
|------|---------|
| CPU (init: gluetun) | 100m request / 2 limit |
| RAM (init: gluetun) | 256Mi request / 4Gi limit |
| CPU (main: qbit) | 200m request / 4 limit |
| RAM (main: qbit) | 512Mi request / 4Gi limit |
| PVCs | `qbit-config` (5 GiB, local-path, RWO), `media-downloads` (5 TiB, LVM, RWX — shared with other media services) |

**Ports:**
- Container `8080` (TCP) — qBittorrent WebUI
- Service `8080` — ClusterIP
- Init container `8000` (TCP) — Gluetun control port
- IngressRoute: `qbittorrent.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Middleware / Ingress:**
- Public host is `qbittorrent.becklab.cloud`. Cluster-internal access via the service also works.

**Init container (Gluetun):**
- **Image:** `qmcgaw/gluetun:latest`
- **VPN provider:** Private Internet Access (PIA), OpenVPN
- **Server region:** SE Stockholm
- **Credentials:** `OPENVPN_USER` and `OPENVPN_PASSWORD` from `gluetun-vpn-secret` Kubernetes secret
- **Firewall:** disabled (`FIREWALL=off`, `FIREWALL_WORKING=off`) — relies on VPN tunnel isolation. `FIREWALL_INPUT_PORTS=8080,8000`
- **DNS:** `DOT=on` (DNS over TLS), `DISABLE_UPDNGX=on`
- **Config storage:** `EmptyDir` (ephemeral, `/etc/gluetun`)
- **Security:** privileged, runs as root, adds `NET_ADMIN`

**Main container (qBittorrent):**
- **Image:** `lscr.io/linuxserver/qbittorrent:latest`
- **Startup probe:** `nc -z localhost 8080` — 30s delay, 10s period, 30 max failures

**Environment variables (qBittorrent):**
- `PUID=1000` — user ID for file ownership.
- `PGID=1000` — group ID for file ownership.
- `TZ=America/Los_Angeles` — timezone.
- `WEBUI_PORT=8080` — WebUI listen port.

**Storage:**
- `/config` → `qbit-config` PVC — qBittorrent settings, RSS feeds, watch folders.
- `/downloads` → `media-downloads` PVC — completed downloads, shared RWX with the rest of the media stack.

**Notes:** Gluetun runs as an init container and exits after the VPN tunnel is established. QBittorrent inherits the VPN network namespace. The Stockholm server region is hardcoded — changing it requires updating the `SERVER_REGIONS` env var. Managed by Flux (`kustomize.toolkit.fluxcd.io/name=infrastructure`).
