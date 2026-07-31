# media

**Purpose:** Media management and streaming stack

**What it does:** Full media ecosystem — Jellyfin (streaming), Sonarr/Radarr/Prowlarr/Bazarr (TV/movie management), SABnzbd/nzbget/qBittorrent+Gluetun (downloads), Tdarr (transcoding), Jellyseerr (request management), Homebox (inventory), Spoolman (3D print filament tracking), Swiparr (Plex metadata), Recyclarr (config sync), Spotweb (Usenet).

**Special resources:** 140+ TiB LVM storage (movies, shows, anime, downloads, torrent, 3dprinting) — NOT backed up by Velero. Gluetun for torrent VPN.

**Note:** Media services currently have NO IngressRoutes — they are internal-only.
