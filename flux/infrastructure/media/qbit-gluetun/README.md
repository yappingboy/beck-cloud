# media/qbit-gluetun

**Purpose:** Torrent downloads with VPN (qBittorrent + Gluetun)

**What it does:** qBittorrent deployment behind Gluetun VPN container with Service and Ingress. Requires secret-gluetun.

**Services:**
- `qbit-gluetun` — Deployment (qBittorrent + Gluetun), Service, Ingress
- `secret-gluetun` — Gluetun credentials secret
