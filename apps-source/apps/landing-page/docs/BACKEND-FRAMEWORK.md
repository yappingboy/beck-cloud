# BeckCloud Landing Page — Backend Framework

## Architecture Overview

```
┌─────────────┐    ┌────────────────────────────────────────────────────────────────────┐
│   Browser    │    │                         BeckCloud Landing Page                      │
│              │    │                                                                    │
│ ┌──────────┐ │    │  ┌──────────┐    ┌────────────┐    ┌────────────────┐            │
│ │Landing   │ │    │  │ Express  │    │  Session   │    │  Auth          │            │
│ │ Page     │◄├────►│  Server  │◄──►│  (Redis)   │◄──►│  Middleware    │            │
│ └──────────┘ │    │  └──────────┘    └────────────┘    └────────────────┘            │
│              │    │       │                                                             │
│ ┌──────────┐ │    │       ├──► [Keycloak Admin API] ──► LLDAP / Keycloak            │
│ │Admin     │ │    │       │                            ──► Realm: homelab           │
│ │ Portal    │ │    │       │                            ──► LDAP bind              │
│ └──────────┘ │    │       ├──► [LLDAP GraphQL]      ──► User directory             │
│              │    │       │                            ──► Group membership         │
│ ┌──────────┐ │    │       ├──► [Directus REST]      ──► CMS content               │
│ │User      │ │    │       │                            ──► Page data              │
│ │ Profile   │ │    │       ├──► [Prometheus API]     ──► Cluster metrics          │
│ │ Portal    │ │    │       │                            ──► Health checks          │
│ └──────────┘ │    │       ├──► [Auth Service]         ──► JWT keys (Go service)  │
│              │    │       │                            ──► Redis-backed keys      │
│              │    │       ├──► [File System]          ──► Tickets, audit log     │
│              │    │       │                            ──► Config, cache          │
│              │    │       └──► [SMTP Relay]           ──► Email notifications    │
└─────────────┘    └────────────────────────────────────────────────────────────────────┘
```

## Components

> **Migration (2026-08-04):** The original Django/Apache setup (Django 5.1, Apache 2.4, WSGI) has been replaced by an Express/Node.js API Gateway. The Django static HTML is preserved in `docs/brand/website/` but is now served by Express rather than Apache. All portal logic (admin, profile, landing) runs through a single Express process on port 8080.

### 1. Express API Gateway (`server.js`)

The central routing and middleware layer. Handles:

- **Static file serving**: Landing page HTML, CSS, JS, admin portal, user profile portal
- **API routing**: REST endpoints for both portals
- **Session management**: Redis-backed sessions for authenticated users
- **Authentication**: Keycloak OAuth2 password flow for user login
- **Authorization**: Role-based access control (RBAC) middleware

**Port**: 8080 (internal), exposed via Traefik IngressRoute on port 80/443

### 2. Session Store (Redis)

`redis://redis.identity.svc.cluster.local:6379`

- Stores Express session data (user ID, roles, tokens)
- Session TTL: 7 days
- Session cookie: `beckcloud.sid` (httpOnly, secure in production)

### 3. Authentication Flow

```
User → /api/auth/login (POST)
         ↓
      Keycloak (password grant)
         ↓
      Access Token + Refresh Token
         ↓
      Express session created
         ↓
      User data cached in session
```

**Keycloak endpoints used:**
- `/realms/homelab/protocol/openid-connect/token` — User login
- `/realms/master/protocol/openid-connect/token` — Admin token
- `/admin/realms/homelab/users` — User CRUD
- `/admin/realms/homelab/groups` — Group management

**Admin credentials** (from `.env`):
- Username: `admin`
- Password: `suCNJ5CtDdHEdy3Zhy6azwgG`
- Client: `admin-cli` (direct grant, no secret)

### 4. User Directory (LLDAP)

`http://lldap.identity.svc.cluster.local:17170`

- **Authentication**: Simple login (`/auth/simple/login`)
- **GraphQL API**: User/group CRUD
- **Source of truth** for user directory

**Admin credentials** (from `.env`):
- Username: `admin`
- Password: `0VFdWI9LXWugx8H0LpV5hePG`

**GraphQL queries used:**
```graphql
# List users
{ users { id email displayName firstName lastName groups { id displayName } } }

# List groups
{ groups { id displayName description memberCount } }

# Create user
mutation CreateUser($user: CreateUserInput!) {
  createUser(user: $user) { id email displayName }
}

# Add to group
mutation AddUserToGroup($userId: String!, $groupId: Int!) {
  addUserToGroup(userId: $userId, groupId: $groupId) { ok }
}
```

### 5. CMS Content (Directus)

`http://directus.cms.svc.cluster.local:8055`

- Fetches landing page content (hero text, service descriptions, etc.)
- Admin-managed content via Directus admin UI
- Token-based auth for read operations

### 6. Monitoring Data (Prometheus)

`http://prometheus.monitoring.svc.cluster.local:9090`

- Cluster stats for admin dashboard (node count, pod count, memory)
- Service health checks via custom queries
- Metrics for uptime tracking

**PromQL queries used:**
```promql
count(kube_node_status_condition{condition="Ready",status="true"})
count(kube_pod_status_phase{phase="Running"})
sum(kube_node_status_allocatable{resource="memory",unit="byte"}) / 1024 / 1024 / 1024
```

### 7. Auth Service (Go)

`/api/v1/keys` — `/api/v1/validate` — `/api/v1/token`

- Separate Go service (in `tools/auth-service/`)
- Redis-backed API key management
- JWT generation for microservice auth
- Used by the landing page for third-party service access

### 8. File Storage

```
/var/lib/beckcloud/
├── tickets.json     # Trouble ticket data
├── audit.log        # Audit log entries
├── config.json      # Local config overrides
└── cache/           # Cached API responses
```

### 9. Email (SMTP)

`smtp-relay.email.svc.cluster.local:25`

- Used for account invitations (via user-invite app)
- Notification emails for ticket updates
- No email-related endpoints in landing page API yet

## API Endpoints Reference

### Auth
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Login with Keycloak | None |
| POST | `/api/auth/logout` | Destroy session | Session |
| GET | `/api/auth/me` | Current user | Session |

### Users (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/users` | List all users | Admin |
| POST | `/api/users` | Create user | Admin |
| PUT | `/api/users/:username` | Update user | Admin |
| DELETE | `/api/users/:username` | Delete user | Admin |

### Groups (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/groups` | List groups | Admin |
| POST | `/api/groups` | Create group | Admin |

### Profile (User)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/profile` | User profile data | Session |
| PUT | `/api/profile` | Update profile | Session |

### Service Health (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health/services` | All service status | Admin |
| GET | `/api/health` | Gateway health | None |

### Audit (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/audit` | Audit log entries | Admin |

### Tickets
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/tickets` | List tickets | Admin |
| POST | `/api/tickets` | Create ticket | Session |

### Cluster Stats (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/cluster/stats` | K3s cluster metrics | Admin |

## Data Flow

### User Login
1. User submits credentials to `/api/auth/login`
2. Express forwards to Keycloak OAuth2 password grant
3. Keycloak returns access_token + refresh_token
4. Express fetches user details via Keycloak Admin API
5. Session created with user data in Redis
6. User redirected to portal

### Admin Dashboard Load
1. Admin navigates to `/admin`
2. Express checks session, verifies `beckcloud.admin` role
3. Express calls LLDAP GraphQL for user list
4. Express calls Prometheus for cluster stats
5. Express calls local file system for audit log
6. All data combined and returned to frontend

### User Profile Update
1. User updates profile in `/portal.html`
2. Frontend POSTs to `/api/profile`
3. Express updates Keycloak user via Admin API
4. Session data updated
5. Success response to frontend

### Service Health Check
1. Admin requests `/api/health/services`
2. Express pings each service URL
3. Health status returned for each service
4. Admin dashboard displays status grid

## Deployment

### Docker (existing)
The current Dockerfile uses Python/Django for static content. The Express gateway runs on port 8080.

### Kubernetes (recommended)
```yaml
# apps/landing-page/deployment.yaml (to be created)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: beckcloud-landing
  namespace: infrastructure
spec:
  replicas: 1
  selector:
    matchLabels:
      app: beckcloud-landing
  template:
    metadata:
      labels:
        app: beckcloud-landing
    spec:
      containers:
        - name: landing
          image: beckcloud/landing-page:latest
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: beckcloud-landing-secrets
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: beckcloud-landing
  namespace: infrastructure
spec:
  selector:
    app: beckcloud-landing
  ports:
    - port: 8080
      targetPort: 8080
---
# IngressRoute via Traefik
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: landing
  namespace: infrastructure
spec:
  entryPoints:
    - web
    - websecure
  routes:
    - match: Host(`landing.becklab.cloud`) || Host(`beckcloud.becklab.cloud`)
      kind: Rule
      services:
        - name: beckcloud-landing
          port: 8080
```

### Secrets (SOPS-encrypted)
```yaml
# flux/infrastructure/landing-page/secrets.sops.yaml
apiVersion: v1
kind: Secret
metadata:
  name: beckcloud-landing-secrets
  namespace: infrastructure
stringData:
  KEYCLOAK_ADMIN_PASSWORD: "suCNJ5CtDdHEdy3Zhy6azwgG"
  LLDAP_ADMIN_PASSWORD: "0VFdWI9LXWugx8H0LpV5hePG"
  SESSION_SECRET: "<random>"
  JWT_SECRET: "<random>"
```

## Dependencies

| Service | Internal URL | Purpose |
|---------|-------------|---------|
| Keycloak | `http://keycloak.identity.svc.cluster.local:8080` | Authentication, user management |
| LLDAP | `http://lldap.identity.svc.cluster.local:17170` | LDAP user directory, groups |
| Redis | `redis://redis.identity.svc.cluster.local:6379` | Session store |
| Directus | `http://directus.cms.svc.cluster.local:8055` | CMS content |
| Prometheus | `http://prometheus.monitoring.svc.cluster.local:9090` | Cluster metrics |
| Auth Service | `http://auth-service.tools.svc.cluster.local:8080` | API keys, JWT |
| SMTP Relay | `smtp-relay.email.svc.cluster.local:25` | Email notifications |

## Security

- **Session cookies**: httpOnly, secure, SameSite=Strict
- **Admin routes**: Require `beckcloud.admin` realm role in Keycloak
- **User routes**: Require any authenticated session
- **API keys**: Hashed and stored in Redis, never returned
- **TLS**: Enforced via Traefik entrypoints
- **CORS**: Same-origin only (default Express behavior)
- **Rate limiting**: Not yet implemented (TODO)

## Future Enhancements

1. **WebSocket support** for real-time ticket updates
2. **File uploads** for ticket attachments
3. **Email notifications** for ticket status changes
4. **LDAP sync** between LLDAP and Keycloak groups
5. **OAuth2 client** registration for new services
6. **Usage analytics** via Prometheus integration
7. **Backup integration** for tickets/audit data
8. **Multi-tenancy** for enterprise tier
