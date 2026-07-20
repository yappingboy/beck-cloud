# BeckCloud Automation Scripts

## sync-homepage-services.py

Automatically discovers all Traefik IngressRoute and Kubernetes Ingress resources in the Flux-managed cluster and generates Homepage (gethomepage.dev) annotations for each.

### What it does

1. **Scans** all YAML files under `flux/` for IngressRoute and Ingress resources
2. **Resolves** the host for each resource (from `Host()` match patterns or name-based fallback)
3. **Generates** Kustomize strategic-merge patches that add `gethomepage.dev/*` annotations
4. **Updates** the Homepage HelmRelease to enable Kubernetes auto-discovery mode
5. **Configures** widgets, settings, and layouts for the Homepage dashboard

### Usage

```bash
# Preview changes
python3 scripts/sync-homepage-services.py --dry-run

# Apply changes
python3 scripts/sync-homepage-services.py
```

### Service Registry

Services are mapped in the `SERVICE_REGISTRY` dict within the script. Each entry maps `(namespace, host)` to:
- Display name, description, group, icon
- Widget type and URL (for live status)
- Weight (ordering within group)

### Widget Types

| Service | Widget Type | Shows |
|---------|------------|-------|
| Jellyfin | jellyfin | Library stats, activity |
| Sonarr | sonarr | Wanted, queued shows |
| Radarr | radarr | Wanted, queued movies |
| Bazarr | bazarr | Subtitle status |
| Prowlarr | prowlarr | Indexer health |
| SABnzbd | sabnzbd | Queue, history |
| NZBGet | nzbget | Queue, history |
| qBittorrent | qbittorrent | Download stats |
| Grafana | grafana | Dashboard count |
| Home Assistant | homeassistant | Devices, entities |
| Spoolman | spoolman | Filament spools |
| Crafty Controller | minecraft | Server status |
| Keycloak | keycloak | Realm info |
| Homebox | homebox | Inventory items |
| Jellyseerr | seerr | Requests |
| Tdarr | tdarr | Transcode queue |

### Architecture

```
flux/infrastructure/webapps/homepage/
├── helmrelease.yaml          # Homepage HelmRelease (updated with post-renderers)
├── kustomization.yaml        # Includes patches/ directory
├── patches/                  # Generated annotation patches
│   ├── kustomization.yaml    # Patch kustomization
│   ├── jellyfin.yaml         # Annotations for media/jellyfin
│   ├── grafana.yaml          # Annotations for monitoring/grafana
│   └── ...                   # One per IngressRoute/Ingress
├── config/                   # Reference configs
│   ├── kubernetes.yaml       # Enables traefik discovery
│   ├── settings.yaml         # Theme, layout
│   └── widgets.yaml          # CPU/memory, datetime, search
└── services-report.json      # Generated summary
```

### Running after adding new services

When a new service is deployed with an IngressRoute or Ingress:
1. Add the `(namespace, host)` entry to `SERVICE_REGISTRY` in the script
2. Run `python3 scripts/sync-homepage-services.py`
3. Commit the generated patches and updated HelmRelease
