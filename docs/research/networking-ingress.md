# Networking & Ingress Deep Dive

**Last audited:** 2026-07-12  
**Scope:** Traefik routing, SSO middleware chains, TLS, network policies

---

## Network Architecture

```
Internet → becklab.cloud DNS → Bare Metal IP (172.16.0.20)
                                      │
                          ┌───────────┴───────────┐
                          │   Traefik NodePort    │
                          │  :80 (:30080 host)     │
                          │  :443 (:30443 host)    │
                          └───────────┬───────────┘
                                      │
                        ┌─────────────┼─────────────┐
                        │             │             │
                  web (80)    websecure (443)   traefik (9000)
                 [redirect-to-https middleware]
                        │
                        ▼
              IngressRoute routing rules
```

### Traefik Configuration
- **Version:** v3.4.3 (Helm chart 36.3.0)
- **Entry points:** `web` (:80), `websecure` (:443), `traefik` (:9000 internal)
- **NodePort mapping:** :80→:30080, :443→:30443 on host nodes

### Traefik Global Middlewares

| Middleware | Namespace | Type | Purpose |
|-----------|-----------|------|---------|
| `redirect-to-https` | traefik | Redirect | Forces HTTP → HTTPS (code 301) |
| `security-headers` | traefik | Headers | Adds X-Frame-Options, CSP, etc. |
| `ws-redirect` | traefik | — | WebSocket redirect handler |

---

## SSO Middleware Architecture

### Admin Tier (`sso-admin-chain`)

```
Request → sso-admin-chain (ChainMiddleware)
           │
           ├── 1. oauth2-redirect-admin (Errors middleware)
           │     └── On 401 → redirect to sso-redirect:80 (nginx login page)
           │
           └── 2. keycloak-forwardauth-admin (ForwardAuth middleware)
                 └── POST to http://oauth2-proxy.identity.svc.cluster.local/oauth2/auth
                       Returns headers: X-Auth-Request-User, X-Auth-Request-Email,
                                       X-Auth-Request-Access-Token, X-Auth-Request-Groups, Authorization
                       trustForwardHeader: true
```

### Media Tier (`sso-media-chain`)

Identical pattern but using separate oauth2-proxy instance:
1. `oauth2-redirect-media` → errors middleware pointing to sso-redirect
2. `keycloak-forwardauth-media` → ForwardAuth against oauth2-proxy-media service

### Authentication Flow (End-to-End)

```
User → Traefik IngressRoute with sso-*-chain middleware
       │
       ▼
   keycloak-forwardauth checks oauth2-proxy
       │
       ├── Authenticated? → Pass through to backend service with user headers
       │
       └── Not authenticated? (401)
             │
             ▼
         oauth2-redirect sends error page → sso-redirect nginx
             │
             ▼
         Redirects user to Keycloak login
             │
             ▼
         Keycloak authenticates against LLDAP (LDAP federation)
             │
             ▼
         User enters credentials → LLDAP validates uid/password
             │
             ▼
         Keycloak issues token → oauth2-proxy stores session in Redis
             │
             ▼
         Redirects back to original URL, now authenticated
```

### SSO Components

| Service | Namespace | Image | Purpose |
|---------|-----------|-------|---------|
| keycloak | identity | quay.io/keycloak/keycloak:26.0 | IdP, federation broker |
| keycloak-postgresql (STS) | identity | — | Keycloak database backend |
| lldap | identity | lldap/lldap:stable | Lightweight LDAP directory (users + groups) |
| oauth2-proxy | identity | quay.io/oauth2-proxy/oauth2-proxy:v7.6.0 | Admin tier reverse proxy auth |
| oauth2-proxy-media | identity | quay.io/oauth2-proxy/oauth2-proxy:v7.6.0 | Media tier reverse proxy auth |
| redis (STS) | identity | — | Session store for oauth2-proxy |
| sso-redirect | identity | nginx:1.27-alpine | Login redirect page on 401 |
| logout-page | identity | nginx:alpine | Logout landing page |

### Group Hierarchy (LLDAP → Keycloak)

| LLDAP Group | Access Level | Services |
|------------|-------------|----------|
| `/admins` | Admin tier | Traefik dashboard, Grafana, Hubble, Rancher, Sonarr, Radarr, Prowlarr, Bazarr, Wazuh, OpenNebula Sunstone, Affine, Directus, Silex |
| `/media` | Media tier | Jellyfin, Jellyseerr |

---

## IngressRoute Inventory

### Currently Active Routes (as of 2026-07-12)

| Route Name | Namespace | Host | Service:Port | SSO Middleware | TLS Secret |
|-----------|-----------|------|-------------|---------------|------------|
| affine | affine | `affine.becklab.cloud` | affine-server:3010 | sso-admin-chain | affine-tls |
| bitwarden-secrets-manager | bitwarden | `bw.becklab.cloud` | bitwarden-secrets-manager:80 | None | bw-tls |
| directus | cms | `cms.becklab.cloud` | directus:8055 | sso-admin-chain | cms-tls |
| grafana | monitoring | `grafana.becklab.cloud` | kube-prometheus-stack-grafana:80 | sso-admin-chain | grafana-tls |
| hubble-ui | monitoring | `hubble.becklab.cloud` | hubble-ui (kube-system):80 | sso-admin-chain | hubble-tls |
| opennebula | opennebula | `one.becklab.cloud` (+ PathPrefix `/fireedge/`) | opennebula-sunstone:2616 | sso-admin-chain | one-tls |
| traefik-dashboard-https | traefik | `traefik.becklab.cloud` | api@internal (TraefikService) | sso-admin-chain | traefik-dashboard-tls |
| silex | landing | `silex.becklab.cloud` | silex:8080 | sso-admin-chain | silex-tls |

### Services Without IngressRoutes (Internal Only)

These services exist in the cluster but have no Traefik routes — accessible only via internal networking or NodePort:

| Namespace | Service | Port | Access Method |
|-----------|---------|------|---------------|
| media/jellyfin | 8096 | Internal cluster only |
| media/sonarr | 8989 | Internal cluster only |
| media/radarr | 7878 | Internal cluster only |
| media/prowlarr | 9696 | Internal cluster only |
| media/bazarr | 6767 | Internal cluster only |
| media/nzbget | 6789 | Internal cluster only |
| media/sabnzbd | 8080 | Internal cluster only |
| media/jellyseerr | 5055 | Internal cluster only |
| media/homebox | 7745 | Internal cluster only |
| media/tdarr | 8265 | Internal cluster only |
| torrent/qbit-gluetun | 8080 | Internal cluster only |
| gaming/crafty | 8443, 8123 | Internal + Minecraft NodePort :31337→:25565 |
| homepage/homepage | 3000 | Internal cluster only |

### Certificates Without Routes (Pre-provisioned)

TLS certificates exist in these namespaces but no corresponding IngressRoutes are deployed yet — likely planned for future exposure:

- **media:** bazarr-tls, homebox-tls, jellyfin-tls, jellyseerr-tls, nzbget-tls, prowlarr-tls, radarr-tls, sabnzbd-tls, sonarr-tls, tdarr-tls
- **spotweb:** spotweb-tls
- **torrent:** qbit-tls
- **gaming:** crafty-tls
- **homepage:** homepage-tls
- **identity:** logout-tls, oauth2-proxy-media-tls, oauth2-proxy-tls, user-invite-tls
- **monitoring:** alertmanager-tls, prometheus-tls

---

## Cilium Network Policies

Cilium v1.17.0 provides:
- Layer 3/4 network policies (standard K8s NetworkPolicy + CiliumNetworkPolicy)
- Hubble for observability (relay + UI deployed in kube-system)
- Ambient mode via cilium-envoy DaemonSet

No custom CiliumNetworkPolicies are currently visible — relying on standard namespace isolation.

---

## DNS Resolution

- **Internal:** CoreDNS 1.12.0 handles cluster.local service discovery
- **External:** Custom domains under `*.becklab.cloud` managed externally, pointing to bare metal IP
- **Custom CoreDNS config** deployed via Flux (`flux/infrastructure/configs/coredns-custom.yaml`) for internal resolution overrides

---

## Known Issues (as of 2026-07-12)

| Issue | Severity | Notes |
|-------|----------|-------|
| oauth2-proxy pods in CrashLoopBackOff | 🔴 High | Both admin and media SSO chains are non-functional — all SSO-protected routes return errors. Keycloak is running but the proxy layer can't authenticate against it. Check `oauth2-proxy` config/credentials for misalignment with current Keycloak client secrets. |

---

*End of networking deep dive.*
