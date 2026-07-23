# Security Audit — BeckCloud Micro Pre-Flight

**Date:** 2026-07-23  
**Author:** Nova  
**Scope:** New `micro` namespace with 12 stateless micro-services exposed to the internet

---

## Current Security Posture

### What's Already In Place ✅

| Control | Status | Details |
|---------|--------|---------|
| **TLS** | ✅ Active | cert-manager ClusterIssuer (`letsencrypt-prod`) — auto-provisioning for all new certs |
| **HTTP→HTTPS redirect** | ✅ Active | `redirect-to-https` middleware in traefik namespace |
| **Security headers** | ✅ Active | `security-headers` middleware (HSTS, X-Frame-Deny, X-Content-Type-Options, XSS filter) |
| **Crowdsec WAF** | ✅ Active | Stream mode on both entrypoints, bans IPs based on behavioral analysis |
| **SSO chains** | ✅ Active | Admin chain (Keycloak + oauth2-proxy) for protected services |
| **Resource quotas** | ✅ Active | Per-namespace quotas already exist (just need one for `micro`) |
| **Redis** | ✅ Available | Identity namespace Redis already deployed (can be used for auth/session) |

### Security Gaps ❌

#### 1. No Rate Limiting on Any Service
**Severity:** 🔴 High  
**Current state:** No `rateLimit` middleware exists on any IngressRoute. Services respond to unlimited requests.
**Risk:** Hash service can be used for crypto bruteforce, URL shortener for link flooding, image resize for DoS.
**Fix:** Per-service rate limiting middleware, applied at the Traefik level.

#### 2. No Per-Service Authentication for Paid Tiers
**Severity:** 🔴 High  
**Current state:** No `forwardAuth`, `basicAuth`, or `digestAuth` middleware exists. No API key auth pattern defined.
**Risk:** Any free-tier user can call paid endpoints; no way to distinguish free vs paid traffic.
**Fix:** JWT-based API key auth via Traefik forwardAuth middleware pointing to a lightweight auth service (Go, <5MB).

#### 3. No IngressRoute-Level Middleware Chaining for Micro Services
**Severity:** 🟡 Medium  
**Current state:** Existing services use single middlewares (one redirect, or one SSO chain). No service applies `security-headers` + `rateLimit` + `auth` in a chain.
**Risk:** New services might forget security headers or rate limits.
**Fix:** Define a `micro-chain` middleware chain that applies security headers + rate limit + optional auth to all micro services.

#### 4. No Request Size Limits
**Severity:** 🟡 Medium  
**Current state:** No `maxRequestBodySize` configured.
**Risk:** Large file upload (image editor) can fill memory. Image resize accepts unlimited input.
**Fix:** `maxRequestBodySize` on Traefik requests (e.g., 50MB for image editor, 5MB for image resize).

#### 5. No CORS Configuration for API Services
**Severity:** 🟡 Medium  
**Current state:** No CORS middleware exists except for Directus (`directus-cors`).
**Risk:** Browser-based services (image editor, BeckFlow) may be blocked or expose data to arbitrary origins.
**Fix:** Per-service CORS middleware with explicit allowed origins.

#### 6. No Per-Service Request/Response Logging
**Severity:** 🟡 Medium  
**Current state:** Traefik access logs capture all traffic but don't distinguish between services at the middleware level.
**Risk:** Hard to audit which service processed which request, detect anomalies.
**Fix:** Add per-service access log labels, or use Traefik's `fields.names` configuration.

#### 7. No IP Allowlist for Admin Endpoints
**Severity:** 🟡 Medium  
**Current state:** No `ipWhiteList` middleware exists anywhere.
**Risk:** Admin-only endpoints (usage dashboard, API key manager) are accessible from any IP.
**Fix:** IP allowlist middleware for admin pages (allow Stephen's home IP + Cloudflare proxy IPs).

#### 8. No Ephemeral Storage TTL Enforcement
**Severity:** 🟢 Low  
**Current state:** No mechanism to expire free-tier data after 24 hours.
**Risk:** Free tier data persists indefinitely, consuming the 10 GiB shared PVC.
**Fix:** Sidecar container or cron job to clean expired files from `micro-storage` PVC.

#### 9. No Health Check Endpoints Defined
**Severity:** 🟢 Low  
**Current state:** No `healthCheck` or `health` middleware on any service.
**Risk:** Helm rollout checks may fail if no `/healthz` endpoint exists.
**Fix:** Each service exposes `/healthz` returning 200 OK.

---

## Required Security Infrastructure

### New Middlewares to Create

All go in the `micro` namespace (except `security-headers` which is in `traefik`):

#### 1. Rate Limiting Middleware (per service)
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit-hash
  namespace: micro
spec:
  rateLimit:
    average: 600   # 100 req/day ≈ 10/min burst, 10/min sustained
    burst: 10
    period: 60s
```

#### 2. Per-Service Auth Middleware (for paid tier)
```yaml
# Auth service endpoint (forwardAuth target)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: auth-micro-paid
  namespace: micro
spec:
  forwardAuth:
    address: "http://auth.micro.svc.cluster.local:8080/auth"
    trustForwardHeader: true
    authResponseHeaders:
      - X-User-Id
      - X-User-Tier
```

#### 3. Middleware Chain for All Micro Services
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: micro-chain
  namespace: micro
spec:
  chain:
    middlewares:
    - name: security-headers   # from traefik namespace
    - name: rate-limit-default # generic rate limit (lower than per-service)
```

#### 4. Request Size Limit
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: micro-maxbody
  namespace: micro
spec:
  # Traefik doesn't have a built-in maxRequestBodySize middleware
  # Use a custom plugin or set in Traefik static config
  # For now: image services get 50MB, others get 10MB
```

#### 5. CORS Middleware (per service that needs it)
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: cors-image-editor
  namespace: micro
spec:
  headers:
    accessControlAllowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    accessControlAllowHeaders:
      - "*"
    accessControlAllowOriginList:
      - https://editor.tools.becklab.cloud
      - https://tools.becklab.cloud
    accessControlMaxAge: 3600
    addVaryHeader: true
```

#### 6. IP Allowlist for Admin Pages
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: micro-ip-whitelist
  namespace: micro
spec:
  ipWhiteList:
    sourceRange:
      - 192.168.100.0/24    # Home LAN
      - 172.16.0.0/12       # OpenNebula internal
      - <Stephen's public IP>  # To be filled in
```

### New IngressRoute Middleware Chains

Each IngressRoute should reference a chain:

```yaml
# Example for hash service
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: hash
  namespace: micro
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`hash.tools.becklab.cloud`)
      kind: Rule
      middlewares:
        - name: security-headers
          namespace: traefik
        - name: rate-limit-hash
          namespace: micro
        - name: cors-hash
          namespace: micro
      services:
        - name: hash-service
          port: 8080
  tls:
    secretName: tools-tls
```

### Auth Service Design

A single lightweight Go service (`auth-micro`) that handles:
- JWT validation for API key auth
- Tier lookup (free vs paid)
- Quota check (requests remaining)
- Returns `200 OK` with headers if allowed, `401` if not

```
POST /auth
Headers: Authorization: Bearer <api_key>

Response (200):
Headers: X-User-Id: <uuid>, X-User-Tier: free|paid, X-Quota-Remaining: <int>

Response (401):
Headers: X-Auth-Error: invalid_key|expired|quota_exceeded
```

This service uses Redis for user data (already deployed). No new database needed.

---

## TLS Certificate Plan

All tools subdomains in a single certificate:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: tools-certificate
  namespace: micro
spec:
  secretName: tools-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: tools.becklab.cloud
  dnsNames:
    - tools.becklab.cloud
    - hash.tools.becklab.cloud
    - short.tools.becklab.cloud
    - convert.tools.becklab.cloud
    - render.tools.becklab.cloud
    - img.tools.becklab.cloud
    - cron.tools.becklab.cloud
    - dns.tools.becklab.cloud
    - webhook.tools.becklab.cloud
    - fmt.tools.becklab.cloud
    - qr.tools.becklab.cloud
    - editor.tools.becklab.cloud
    - auth.tools.becklab.cloud
```

**Note:** Let's Encrypt has a limit of 300 subdomains per registered domain per week. We're well under that at 13 subdomains.

---

## Rate Limit Matrix

| Service | Free Tier | Paid Tier | Reasoning |
|---------|-----------|-----------|-----------|
| Hash | 100/day | Unlimited | Near-zero cost, mostly CPU |
| URL Shortener | 100 links/day | Unlimited | SQLite write cost |
| Base64 | 100/day | Unlimited | Near-zero cost |
| Markdown | 50/day | Unlimited | Pandoc is heavier |
| Image Resize | 100/day | Unlimited | libvips + disk I/O |
| Cron Jobs | 10 jobs | 50 jobs | Background process overhead |
| DNS Monitor | 50 checks/day | Unlimited | DNS query cost |
| Webhook Relay | 100/day | Unlimited | Redis write + retry queue |
| YAML/JSON | 200/day | Unlimited | Near-zero cost |
| QR Code | 50/month | Unlimited | Near-zero cost |
| Image Editor | 10 saves/day | Unlimited | Canvas save + storage |
| BeckFlow | 50 runs/month | Unlimited | Multi-service orchestration |

---

## Security Checklist for Launch

- [ ] `micro` namespace created with resource quota (4 CPU, 2 GiB memory)
- [ ] TLS certificate issued for all `*.tools.becklab.cloud` subdomains
- [ ] Security headers middleware applied to all services
- [ ] Rate limiting middleware applied to all services
- [ ] Auth service deployed and configured
- [ ] Middleware chains defined and referenced in all IngressRoutes
- [ ] CORS configured for browser-facing services (image editor, BeckFlow)
- [ ] Request size limits configured (50MB for image, 10MB for others)
- [ ] Crowdsec WAF active (inherits from global config)
- [ ] Ephemeral storage cleanup job configured
- [ ] Health check endpoints on all services
- [ ] Admin IP allowlist configured
- [ ] Per-service access logging verified
- [ ] Load test passes (hash: 1000 req/sec, image: 10 concurrent, beckflow: 50 concurrent)
- [ ] Free tier enforced (send 150 requests, verify 50 rejected)
- [ ] Paid tier enforced (API key passes, invalid key gets 401)
- [ ] TLS cert expires >30 days out (cert-manager renewal working)
- [ ] Redis connection stable (auth success, no connection drops)

---

*End of security audit.*
*Next step: Create Workboard card for security infrastructure, then deploy Phase 1.*
