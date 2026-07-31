# BeckCloud Admin Panel

**Central admin dashboard** for BeckCloud, deployed at `admin.beckcloud.cloud`.

## Features

- **Dashboard** — System overview with stats cards, quick actions, recent audit entries, and service health at a glance
- **User Management** — Full CRUD for users with role assignment, status management, search, and filtering
- **Groups & Roles** — RBAC role hierarchy display, service access matrix, and group creation
- **Trouble Tickets** — Ticket creation, filtering by status, priority badges, and comment tracking
- **Audit Log** — Complete history of admin actions with search and type filtering
- **Service Health** — All 26 services with live status dots, uptime, and latency metrics
- **Quick Actions** — 12 common admin operations accessible from one click

## Architecture

The admin panel is a **static HTML/CSS/JS application** served by nginx inside the `webapps` namespace. It:

1. Uses the **same brand design system** as the portal (CSS custom properties, fonts, logo, color palette)
2. Authenticates via **SSO** (oauth2-proxy → Keycloak, same as the portal)
3. Requires the **`beckcloud.admin`** realm role in Keycloak
4. Displays mock data that can be wired to the Directus API

## Brand Compliance

- **Colors**: Ember Gold `#E8A838`, Violet Haze `#7C5CFC`, Coral Pulse `#FF6B4A`, Deep Space `#0F1729`
- **Fonts**: JetBrains Mono (headings), Inter (body)
- **Logo**: Hexagon with ember, from the brand spec
- **Pattern**: Dark-mode-first, follows the portal sidebar + main layout pattern
- **Badges**: Role badges (admin/user/media/3d/llm/ONE), status badges (active/inactive/suspended), ticket badges (new/open/pending/resolved/closed), service health badges (healthy/degraded/down/maintenance)

## Deployment

### Via kubectl

```bash
# Create/update configmap with admin files
kubectl create configmap admin-panel-content \
  -n webapps \
  --from-file=beck-cloud/docs/brand/website/admin/ \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment to pick up changes
kubectl rollout restart deployment/admin-panel -n webapps
```

### Flux (GitOps)

The admin panel resources are in:
- `beck-cloud/flux/infrastructure/webapps/admin-panel/`

Flux will automatically apply and sync.

## Directus Integration

Collections defined for admin data in:
- `beck-cloud/flux/infrastructure/directus/admin-collections/`

Collections:
- `bc_users` — User accounts
- `bc_tickets` — Trouble tickets
- `bc_audit_log` — Audit log entries

## File Structure

```
admin/
├── index.html          # Main HTML (full layout, sections, modals)
├── README.md           # This file
├── css/
│   ├── admin.css       # Admin-specific styles (extends style.css)
│   └── style.css       # Shared brand styles (copied from parent)
└── js/
    ├── admin.js        # Main application logic
    └── deploy.sh       # Deployment helper script
```

## Keycloak RBAC

The admin panel enforces access via these realm roles:

| Role | Slug | Access |
|------|------|--------|
| Admin | `beckcloud.admin` | Full admin panel access |
| User | `beckcloud.user` | Portal only |
| Media | `beckcloud.media` | Media services |
| 3D Printing | `beckcloud.3dprinting` | 3D printing services |
| LLM | `beckcloud.llm` | Nova AI access |
| OpenNebula | `beckcloud.opennebula` | VM management |

The Traefik middleware chain `sso-admin-chain` (in `identity` namespace) handles SSO + admin role checking before routing to the admin panel.
