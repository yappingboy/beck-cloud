# Networking & Ingress Deep Dive

**Last audited:** 2026-07-20  
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
| `crowdsec-bouncer` | traefik | Plugin (Bouncer) | Crowdsec WAF — blocks banned IPs in stream mode |
| `redirect-to-https` | traefik | Redirect | Forces HTTP → HTTPS (code 301) |
| `security-headers` | traefik | Headers | Adds X-Frame-Options, CSP, etc. |
| `ws-redirect` | traefik | — | WebSocket redirect handler |

### Crowdsec Bouncer Integration

The `crowdsec-bouncer` middleware is applied globally to both `web` and `websecure` entrypoints via Traefik's `additionalArguments`:

```
--entrypoints.web.http.middlewares=traefik-crowdsec-bouncer@kubernetescrd
--entrypoints.websecure.http.middlewares=traefik-crowdsec-bouncer@kubernetescrd
```

It runs as an experimental Traefik plugin (`maxlerebourg/crowdsec-bouncer-traefik-plugin` v1.4.5) and connects to the Crowdsec LAPI in the `crowdsec` namespace via stream mode. The bouncer key is mounted from the `crowdsec-bouncer-key` secret as a file at `/etc/traefik/crowdsec/BOUNCER_KEY_traefik`.

**Traffic order:** Crowdsec bouncer → SSO chain → backend service. Banned IPs get a 429 before they even reach the SSO layer.

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

### Admin Tier — No Auth Header (`sso-admin-chain-no-auth-header`)

**NEW** since July 12. Identical to admin chain but without forwarding the `Authorization` header — used by Home Assistant which has issues with forwarded auth headers.

1. `oauth2-redirect-admin` → errors middleware pointing to sso-redirect
2. `keycloak-forwardauth-admin-no-auth-header` → ForwardAuth against oauth2-proxy (no auth header passthrough)

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
| `/admins` | Admin tier | Traefik dashboard, Grafana, Hubble, Rancher, Sonarr, Radarr, Prowlarr, Bazarr, Wazuh, OpenNebula Sunstone, Affine, Directus, Silex, OpenClaw, Home Assistant |
| `/media` | Media tier | Jellyfin, Jellyseerr |

---

## IngressRoute Inventory

### Currently Active Routes (as of 2026-07-20)

| Route Name | Namespace | Host | SSO Middleware | TLS Secret |
|-----------|-----------|------|---------------|------------|
| affine | webapps | `affine.becklab.cloud` | sso-admin-chain | affine-tls |
| bitwarden-secrets-manager | webapps | `bw.becklab.cloud` | None | bw-tls |
| directus | webapps | `cms.becklab.cloud` | sso-admin-chain | cms-tls |
| grafana | monitoring | `grafana.becklab.cloud` | sso-admin-chain | grafana-tls |
| home-assistant | webapps | `ha.becklab.cloud` (+ PathPrefix `/esphome`, `/mqtt`, `/api/websocket`) | sso-admin-chain-no-auth-header + esphome-strip-prefix/mqtt-strip-prefix | ha-tls |
| hubble-ui | monitoring | `hubble.becklab.cloud` | sso-admin-chain | hubble-tls |
| kiri-moto | gridspace | `kiri.becklab.cloud` | gridspace-kiri-root-redirect | kiri-tls |
| mesh-tool | gridspace | `mesh.becklab.cloud` | gridspace-mesh-root-redirect | mesh-tls |
| openclaw | webapps | `nova.becklab.cloud` | sso-admin-chain | nova-tls |
| opennebula | opennebula | `one.becklab.cloud` (+ PathPrefix `/fireedge/`) | sso-admin-chain | one-tls |
| silex | webapps | `silex.becklab.cloud` | sso-admin-chain | silex-tls |
| traefik-dashboard-https | traefik | `traefik.becklab.cloud` | sso-admin-chain | traefik-dashboard-tls |
| void-form | gridspace | `void.becklab.cloud` | gridspace-void-root-redirect | void-tls |

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
| media/qbit-gluetun | 8080 | Internal cluster only |
| media/jellyseerr | 5055 | Internal cluster only |
| media/homebox | 7745 | Internal cluster only |
| media/tdarr | 8265 | Internal cluster only |
| media/spotweb | 80 | Internal cluster only |
| gaming/crafty | 8443, 8123 | Internal + Minecraft NodePort :31337→:25565 |
| webapps/homepage | 3000 | Internal cluster only |

### Micro Services Middlewares (NEW — 2026-07-23)

| Middleware | Namespace | Type | Purpose |
|-----------|-----------|------|----------|
| `rate-limit-hash` | micro | RateLimit | Hash service: 100/min, burst 20 |
| `rate-limit-short` | micro | RateLimit | URL shortener: 100/min, burst 20 |
| `rate-limit-base64` | micro | RateLimit | Base64: 100/min, burst 20 |
| `rate-limit-markdown` | micro | RateLimit | Markdown: 50/min, burst 10 |
| `rate-limit-resize` | micro | RateLimit | Image resize: 100/min, burst 20 |
| `rate-limit-cron` | micro | RateLimit | Cron jobs: 10/min, burst 5 |
| `rate-limit-dns` | micro | RateLimit | DNS monitor: 50/min, burst 10 |
| `rate-limit-webhook` | micro | RateLimit | Webhook relay: 100/min, burst 20 |
| `rate-limit-fmt` | micro | RateLimit | YAML/JSON: 200/min, burst 40 |
| `rate-limit-qr` | micro | RateLimit | QR code: 50/min, burst 10 |
| `rate-limit-editor` | micro | RateLimit | Image editor: 10/min, burst 5 |
| `rate-limit-beckflow` | micro | RateLimit | BeckFlow: 50/min, burst 10 |
| `auth-micro-paid` | micro | ForwardAuth | API key validation via auth-micro |
| `cors-editor` | micro | Headers | CORS for image editor |
| `cors-beckflow` | micro | Headers | CORS for BeckFlow |
| `micro-maxbody-image` | micro | Buffering | 50 MB request size limit (image services) |
| `micro-maxbody-default` | micro | Buffering | 10 MB request size limit (other services) |
| `micro-ip-whitelist` | micro | IPWhiteList | Admin page access control |
| `micro-health` | micro | Headers | Health check response header |

### Micro IngressRoutes (NEW — 2026-07-23)

| Route Name | Namespace | Host | Middleware Chain | TLS Secret |
|-----------|-----------|------|-----------------|------------|
| hash | micro | `hash.tools.becklab.cloud` | security-headers + rate-limit-hash + maxbody-default | tools-tls |
| short | micro | `short.tools.becklab.cloud` | security-headers + rate-limit-short + maxbody-default | tools-tls |
| base64 | micro | `base64.tools.becklab.cloud` | security-headers + rate-limit-base64 + maxbody-default | tools-tls |
| markdown | micro | `markdown.tools.becklab.cloud` | security-headers + rate-limit-markdown + maxbody-default | tools-tls |
| resize | micro | `resize.tools.becklab.cloud` | security-headers + rate-limit-resize + maxbody-image | tools-tls |
| cron | micro | `cron.tools.becklab.cloud` | security-headers + rate-limit-cron + auth-micro-paid + maxbody-default | tools-tls |
| dns | micro | `dns.tools.becklab.cloud` | security-headers + rate-limit-dns + auth-micro-paid + maxbody-default | tools-tls |
| webhook | micro | `webhook.tools.becklab.cloud` | security-headers + rate-limit-webhook + maxbody-default | tools-tls |
| fmt | micro | `fmt.tools.becklab.cloud` | security-headers + rate-limit-fmt + maxbody-default | tools-tls |
| qr | micro | `qr.tools.becklab.cloud` | security-headers + rate-limit-qr + maxbody-default | tools-tls |
| editor | micro | `editor.tools.becklab.cloud` | security-headers + rate-limit-editor + cors-editor + maxbody-image | tools-tls |
| beckflow | micro | `beckflow.tools.becklab.cloud` | security-headers + rate-limit-beckflow + cors-beckflow + maxbody-default | tools-tls |
| auth-admin | micro | `auth.tools.becklab.cloud` | security-headers + rate-limit-hash + micro-ip-whitelist + maxbody-default | tools-tls |

TLS certificates exist but no corresponding IngressRoutes are deployed yet — likely planned for future exposure:

- **media:** bazarr-tls, homebox-tls, jellyfin-tls, jellyseerr-tls, nzbget-tls, prowlarr-tls, radarr-tls, sabnzbd-tls, sonarr-tls, tdarr-tls, spotweb-tls, qbit-tls
- **gaming:** crafty-tls
- **webapps:** homepage-tls, landing-tls
- **identity:** logout-tls, oauth2-proxy-media-tls, oauth2-proxy-tls, user-invite-tls, mail-becklab
- **monitoring:** alertmanager-tls, prometheus-tls
- **security:** wazuh-becklab-cloud-tls

---

## Webapp-Specific Middlewares

### Gridspace Redirect Middlewares (NEW)

| Middleware | Namespace | Type | Purpose |
|-----------|-----------|------|---------|
| `gridspace-kiri-root-redirect` | gridspace | Redirect | Root path redirect for Kiri:moto |
| `gridspace-mesh-root-redirect` | gridspace | Redirect | Root path redirect for Mesh Tool |
| `gridspace-void-root-redirect` | gridspace | Redirect | Root path redirect for Void:Form |

### Home Assistant Middlewares (NEW)

| Middleware | Namespace | Type | Purpose |
|-----------|-----------|------|---------|
| `esphome-strip-prefix` | webapps | StripPrefix | Strips `/esphome` prefix for ESPHome dashboard |
| `mqtt-strip-prefix` | webapps | StripPrefix | Strips `/mqtt` prefix for MQTT WebSocket |

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

## Known Issues (as of 2026-07-20)

No known networking issues. All IngressRoutes serving healthy backends. oauth2-proxy CrashLoopBackOff from July 12 has been resolved.

### Certificates Without Routes (Pre-provisioned)

TLS certificates exist but no corresponding IngressRoutes are deployed yet — likely planned for future exposure:

- **media:** bazarr-tls, homebox-tls, jellyfin-tls, jellyseerr-tls, nzbget-tls, prowlarr-tls, radarr-tls, sabnzbd-tls, sonarr-tls, tdarr-tls, spotweb-tls, qbit-tls
- **gaming:** crafty-tls
- **webapps:** homepage-tls, landing-tls
- **identity:** logout-tls, oauth2-proxy-media-tls, oauth2-proxy-tls, user-invite-tls, mail-becklab
- **monitoring:** alertmanager-tls, prometheus-tls
- **security:** wazuh-becklab-cloud-tls

---

*End of networking deep dive.*
