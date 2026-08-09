# BeckCloud Landing Page Framework

## Overview

This directory contains the BeckCloud landing page application, admin portal, and user profile management portal.

## Structure

```
apps/landing-page/
├── README.md              # This file
├── server.js              # Express API gateway (replaces Django for dynamic routes)
├── Dockerfile             # Deployment container
├── config/
│   └── beckcloud/
│       ├── settings.py    # Django settings (static content only)
│       ├── urls.py        # Django URL routes (static serving)
│       └── ...
├── src/                   # Source code for the app
│   ├── routes/            # API route handlers
│   │   ├── auth.js        # Auth endpoints (Keycloak integration)
│   │   ├── users.js       # User CRUD
│   │   ├── groups.js      # Group/role management
│   │   ├── tickets.js     # Trouble tickets
│   │   ├── audit.js       # Audit log
│   │   └── health.js      # Service health checks
│   ├── middleware/        # Express middleware
│   │   ├── auth.js        # JWT/Keycloak session middleware
│   │   └── rbac.js        # Role-based access control
│   └── services/          # External service integrations
│       ├── keycloak.js    # Keycloak Admin API client
│       ├── lldap.js       # LLDAP GraphQL client
│       ├── directus.js    # Directus CMS client
│       └── prometheus.js  # Prometheus metrics client
├── public/                # Static assets (served by Express)
│   ├── index.html         # Landing page (main)
│   ├── portal.html        # User profile portal
│   ├── admin/
│   │   ├── index.html     # Admin portal
│   │   ├── css/
│   │   │   ├── style.css  # Shared styles
│   │   │   └── admin.css  # Admin-specific styles
│   │   └── js/
│   │       ├── admin.js   # Admin portal logic
│   │       └── portal.js  # User portal logic
│   └── js/
│       └── main.js        # Landing page logic
├── templates/             # EJS/Handlebars templates (if needed)
└── docs/                  # Architecture documentation
    └── BACKEND-FRAMEWORK.md
```

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables (see .env.example)
cp .env.example .env
# Edit .env with your values

# Run development server
npm run dev

# Build for production
npm run build
```

## API Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Service health check | None |
| POST | `/api/auth/login` | Login via Keycloak | None |
| POST | `/api/auth/logout` | Logout | Session |
| GET | `/api/auth/me` | Current user info | Session |
| GET | `/api/users` | List all users | Admin |
| POST | `/api/users` | Create user | Admin |
| GET | `/api/users/:id` | Get user details | Admin |
| PUT | `/api/users/:id` | Update user | Admin |
| DELETE | `/api/users/:id` | Delete user | Admin |
| GET | `/api/groups` | List groups | Admin |
| POST | `/api/groups` | Create group | Admin |
| GET | `/api/tickets` | List tickets | Admin |
| POST | `/api/tickets` | Create ticket | Admin/User |
| GET | `/api/audit` | Audit log | Admin |
| GET | `/api/health/services` | Service health | Admin |
| GET | `/api/profile` | User profile | Session |
| PUT | `/api/profile` | Update profile | Session |
| GET | `/api/profile/sessions` | Active sessions | Session |
| DELETE | `/api/profile/sessions/:id` | Revoke session | Session |

## Environment Variables

See `.env.example` for the full list. Key variables:

- `KEYCLOAK_URL` — Keycloak Admin API URL
- `KEYCLOAK_REALM` — Keycloak realm name
- `KEYCLOAK_ADMIN_CLIENT_ID` — Admin client ID
- `LLDAP_URL` — LLDAP API URL
- `DIRECTUS_URL` — Directus CMS URL
- `PROMETHEUS_URL` — Prometheus API URL
- `SESSION_SECRET` — Express session secret
- `JWT_SECRET` — JWT signing secret
- `REDIS_URL` — Redis connection string
