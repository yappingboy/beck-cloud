# Jellyfin + Jellyseerr True SSO Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the oauth2-proxy gate pattern with true SSO integration for Jellyfin (SAML via JellyfinSSO plugin) and Jellyseerr (native OIDC), so users log into Keycloak once and are automatically logged into both apps.

**Architecture:** Keycloak acts as the IdP for both apps. Jellyfin uses SAML 2.0 via the JellyfinSSO community plugin. Jellyseerr uses its built-in OAuth2/OIDC support. Group-based access control enforced via Keycloak client scopes (/admins, /media). Removes oauth2-proxy middleware from both Ingresses.

**Tech Stack:** Keycloak (SAML + OIDC), JellyfinSSO plugin, Jellyseerr native OIDC, Traefik Ingress, Flux GitOps, SOPS-encrypted K8s secrets.

---

## Prerequisites (Manual — Keycloak Admin UI)

These MUST be done before deploying. No automation available for Keycloak config.

### Step M1: Create Jellyfin SAML Client

1. Keycloak Admin → homelab realm → **Clients** → **Create client**
2. **Client type:** SAML
3. **Client ID:** `jellyfin`
4. Click **Next**

**Settings tab:**
| Field | Value |
|-------|-------|
| Root URL | `https://jellyfin.becklab.cloud` |
| Home URL | `https://jellyfin.becklab.cloud` |
| Base URL | `/` |
| Valid post redirect URIs | `https://jellyfin.becklab.cloud/*` |
| Valid signature algorithms | RSA-SHA256 |
| Client signature | On |
| Client authentication | On |
| Force POST bindings | On |

**Roles tab:** keep defaults.

Click **Save**.

### Step M2: Configure Jellyfin SAML Mappers

Go to **Clients** → **jellyfin** → **Mappers** tab → **Add mapper** → **By configuration** → **User Property**:

**Mapper 1 — username:**
| Field | Value |
|-------|-------|
| Name | `username` |
| User attribute | `username` |
| SAML attribute name | `username` |
| SAML attribute name format | Basic |
| SAML attribute value | `${username}` |

**Mapper 2 — email:**
| Field | Value |
|-------|-------|
| Name | `email` |
| User attribute | `email` |
| SAML attribute name | `email` |
| SAML attribute name format | Basic |
| SAML attribute value | `${email}` |

**Mapper 3 — displayName:**
| Field | Value |
|-------|-------|
| Name | `displayName` |
| User attribute | `firstName` |
| SAML attribute name | `displayName` |
| SAML attribute name format | Basic |
| SAML attribute value | `${firstName}` |

Click **Save** after each.

### Step M3: Create Jellyseerr OIDC Client

1. Keycloak Admin → homelab realm → **Clients** → **Create client**
2. **Client type:** OpenID Connect
3. **Client ID:** `jellyseerr`
4. Click **Next**

**Capability config:**
- **Client authentication:** On
- **Authorization:** Off

Click **Next**, then **Login settings:**
| Field | Value |
|-------|-------|
| Valid redirect URIs | `https://requests.becklab.cloud/oauth2/oidc/callback` |
| Web origins | (leave empty) |

Click **Save**.

### Step M4: Restrict Jellyseerr to Media Group

1. **Client Scopes** → find the existing `groups` scope → **Mappers** tab — verify it has the Group Membership mapper
2. **Clients** → **jellyseerr** → **Client Scopes** tab → **Add client scope** → search `groups` → **Add** → choose **Default**

This ensures the `groups` claim is included in tokens. Jellyseerr's OAuth2 will auto-create users. Access restriction is enforced because only users in `/admins` or `/media` groups should be able to authenticate (Keycloak only returns federated users from LLDAP).

### Step M5: Copy Client Secrets

**Jellyseerr client:**
1. **Clients** → **jellyseerr** → **Credentials** tab
2. Copy the **Client secret**
3. This will be used to populate `secret-jellyseerr-oidc.yaml`

---

## Task 1: Generate Jellyseerr OIDC client secret

**Objective:** Create the SOPS-encrypted K8s secret for Jellyseerr OIDC credentials.

**Files:**
- Create: `flux/infrastructure/media/secret-jellyseerr-oidc.yaml`

**Step 1: Generate the secret file**

```bash
cd /root/beck-cloud

# Create the secret template
cat > flux/infrastructure/media/secret-jellyseerr-oidc.yaml << 'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: jellyseerr-oidc
  namespace: media
stringData:
  client-id: "jellyseerr"
  client-secret: "<PASTE_KEYCLOAK_CLIENT_SECRET_HERE>"
sops: {}
EOF
```

**Step 2: Encrypt with SOPS**

```bash
sops -i flux/infrastructure/media/secret-jellyseerr-oidc.yaml
```

This encrypts the `stringData` section using the existing SOPS age key (same key used for `secret-oauth2-proxy.yaml`).

**Step 3: Verify**

```bash
# Check it has SOPS headers and encrypted data
head -5 flux/infrastructure/media/secret-jellyseerr-oidc.yaml
# Should show sops: section with age encryption
```

**Step 4: Commit**

```bash
git add flux/infrastructure/media/secret-jellyseerr-oidc.yaml
git commit -m "feat: add jellyseerr OIDC secret for Keycloak SSO"
```

**Verify:** File is encrypted (no plaintext secrets visible), has proper SOPS headers matching other secrets in the repo.

---

## Task 2: Update Jellyfin deployment with plugins support and JellyfinSSO init

**Objective:** Add a plugins volume and an init container that downloads JellyfinSSO plugin, enabling SAML SSO.

**Files:**
- Modify: `flux/infrastructure/media/jellyfin.yaml`

**Step 1: Update the Deployment**

Add a `plugins` volume (emptyDir is fine — the init container populates it, and it persists as long as the pod runs). Add an `initContainers` section that downloads the JellyfinSSO plugin. Add a `plugins` volumeMount to the main container.

The updated `flux/infrastructure/media/jellyfin.yaml` should look like this:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jellyfin
  namespace: media
  labels:
    app: jellyfin
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jellyfin
  template:
    metadata:
      labels:
        app: jellyfin
    spec:
      nodeSelector:
        kubernetes.io/hostname: ip-192-168-100-11
      securityContext:
        fsGroup: 1000
      initContainers:
        - name: install-jellyfinsso
          image: curlimages/curl:latest
          command:
            - sh
            - -c
            - |
              mkdir -p /plugins
              curl -fSL -o /plugins/JellyfinSSO.dll \
                https://github.com/cilc/JellyfinSSO/releases/latest/download/JellyfinSSO.dll
              echo "JellyfinSSO plugin downloaded"
              ls -la /plugins/
          volumeMounts:
            - name: plugins
              mountPath: /plugins
      containers:
        - name: jellyfin
          image: lscr.io/linuxserver/jellyfin:latest
          resources:
            limits:
              cpu: "8"
              memory: 8Gi
            requests:
              cpu: 1
              memory: 2Gi
          env:
            - name: PUID
              value: "1000"
            - name: PGID
              value: "1000"
            - name: TZ
              value: America/New_York
          ports:
            - containerPort: 8096
              name: http
              protocol: TCP
          volumeMounts:
            - name: config
              mountPath: /config
            - name: plugins
              subPath: plugins
              mountPath: /config/plugins
            - name: media-movies
              mountPath: /data/movies
            - name: media-shows
              mountPath: /data/shows
            - name: media-anime
              mountPath: /data/anime
      volumes:
        - name: config
          persistentVolumeClaim:
            claimName: jellyfin-config
        - name: plugins
          emptyDir: {}
        - name: media-movies
          persistentVolumeClaim:
            claimName: media-movies
        - name: media-shows
          persistentVolumeClaim:
            claimName: media-shows
        - name: media-anime
          persistentVolumeClaim:
            claimName: media-anime
---
apiVersion: v1
kind: Service
metadata:
  name: jellyfin
  namespace: media
spec:
  selector:
    app: jellyfin
  ports:
    - name: http
      port: 8096
      targetPort: 8096
      protocol: TCP
  type: ClusterIP
```

Note: The Ingress is in the same file — leave it unchanged for now (Task 3 handles it).

**Step 2: Verify YAML syntax**

```bash
kubectl --dry-run=client -o yaml -f flux/infrastructure/media/jellyfin.yaml >/dev/null 2>&1 && echo "YAML valid" || echo "YAML invalid"
```

**Step 3: Commit**

```bash
git add flux/infrastructure/media/jellyfin.yaml
git commit -m "feat: add JellyfinSSO plugin init container and plugins volume"
```

**Verify:** Deployment has initContainers section with curl downloading JellyfinSSO.dll, plugins volume mounted at /config/plugins in main container.

---

## Task 3: Update Jellyfin Ingress (remove any future middleware, keep direct)

**Objective:** Ensure Jellyfin Ingress has NO oauth2-proxy middleware — SSO is handled by the JellyfinSSO plugin internally via SAML redirect.

**Files:**
- Modify: `flux/infrastructure/media/jellyfin.yaml` (Ingress section at bottom)

The Ingress section should remain as-is (no middlewares annotation). Current state is already correct — no SSO middleware annotation exists. Just confirm it stays this way:

```yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jellyfin
  namespace: media
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - jellyfin.becklab.cloud
      secretName: jellyfin-tls
  rules:
    - host: jellyfin.becklab.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: jellyfin
                port:
                  number: 8096
```

No changes needed if it matches. **Just verify and commit if any other changes were made in Task 2.**

---

## Task 4: Update Jellyseerr deployment with OIDC environment variables

**Objective:** Add OIDC authentication environment variables to Jellyseerr, enabling native OAuth2/OIDC login with Keycloak.

**Files:**
- Modify: `flux/infrastructure/media/jellyseerr.yaml`

**Step 1: Add OIDC env vars to the container**

The updated Deployment section in `jellyseerr.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jellyseerr
  namespace: media
  labels:
    app: jellyseerr
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jellyseerr
  template:
    metadata:
      labels:
        app: jellyseerr
    spec:
      nodeSelector:
        kubernetes.io/hostname: ip-192-168-100-11
      securityContext:
        fsGroup: 1000
      containers:
        - name: jellyseerr
          image: ghcr.io/fallenbagel/jellyseerr:latest
          resources:
            limits:
              cpu: "1"
              memory: 2Gi
            requests:
              cpu: 200m
              memory: 512Mi
          env:
            - name: LOG_LEVEL
              value: info
            - name: DOCKER_MODE
              value: "true"
            - name: OIDC_ENABLED
              value: "true"
            - name: OIDC_CLIENT_ID
              value: "jellyseerr"
            - name: OIDC_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: jellyseerr-oidc
                  key: client-secret
            - name: OIDC_ISSUER
              value: "https://keycloak.becklab.cloud/realms/homelab"
            - name: OIDC_SCOPES
              value: "openid profile email"
            - name: OIDC_BUTTON_TEXT
              value: "Log in with Keycloak"
            - name: OIDC_AUTO
              value: "true"
            - name: OIDC_EMAIL_DOMAIN
              value: "*"
          ports:
            - containerPort: 5055
              name: http
              protocol: TCP
          volumeMounts:
            - name: config
              mountPath: /app/config
      volumes:
        - name: config
          persistentVolumeClaim:
            claimName: jellyseerr-config
```

Key changes:
- Added `DOCKER_MODE=true` (required for some Jellyseerr config detection)
- Added `OIDC_ENABLED=true` through `OIDC_EMAIL_DOMAIN=*`
- `OIDC_AUTO=true` means users are automatically redirected to Keycloak login (no manual button click needed)
- `OIDC_CLIENT_SECRET` read from the new `jellyseerr-oidc` secret

**Step 2: Verify YAML syntax**

```bash
# Dry run validation
python3 -c "
import yaml, sys
with open('flux/infrastructure/media/jellyseerr.yaml') as f:
    docs = list(yaml.safe_load_all(f))
print(f'Parsed {len(docs)} YAML documents OK')
for i, doc in enumerate(docs):
    print(f'  Doc {i}: {doc[\"kind\"]} {doc[\"metadata\"][\"name\"]}')
"
```

**Step 3: Commit**

```bash
git add flux/infrastructure/media/jellyseerr.yaml
git commit -m "feat: enable Jellyseerr native OIDC SSO with Keycloak"
```

**Verify:** Deployment has OIDC env vars, secretKeyRef points to jellyseerr-oidc secret.

---

## Task 5: Update Jellyseerr Ingress (remove oauth2-proxy middleware)

**Objective:** Remove the `identity-sso-media-chain@kubernetescrd` middleware from Jellyseerr Ingress since SSO is now handled natively by the app.

**Files:**
- Modify: `flux/infrastructure/media/jellyseerr.yaml` (Ingress section)

**Step 1: Remove the middleware annotation**

Change this:
```yaml
    traefik.ingress.kubernetes.io/router.middlewares: identity-sso-media-chain@kubernetescrd
```

The updated Ingress section:

```yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jellyseerr
  namespace: media
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - requests.becklab.cloud
      secretName: jellyseerr-tls
  rules:
    - host: requests.becklab.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: jellyseerr
                port:
                  number: 5055
```

The `traefik.ingress.kubernetes.io/router.middlewares` annotation is removed.

**Step 2: Commit**

```bash
git add flux/infrastructure/media/jellyseerr.yaml
git commit -m "chore: remove oauth2-proxy middleware from jellyseerr ingress (native OIDC)"
```

**Verify:** No `router.middlewares` annotation on jellyseerr Ingress.

---

## Task 6: Update media kustomization to include new secret

**Objective:** Add the new `secret-jellyseerr-oidc.yaml` to the media namespace Kustomization.

**Files:**
- Modify: `flux/infrastructure/media/kustomization.yaml`

**Step 1: Add the secret to resources**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - pvs-lvm.yaml
  - pvcs.yaml
  - secret-gluetun.yaml
  - secret-recyclarr.yaml
  - secret-jellyseerr-oidc.yaml
  - jellyfin.yaml
  - jellyseerr.yaml
  - sonarr.yaml
  - radarr.yaml
  - prowlarr.yaml
  - bazarr.yaml
  - recyclarr.yaml
  - qbit-gluetun.yaml
  - nzbget.yaml
```

Added `secret-jellyseerr-oidc.yaml` in the secrets section.

**Step 2: Verify kustomize builds**

```bash
ssh -o StrictHostKeyChecking=no -i /root/.ssh/K3s ubuntu@192.168.100.10 "cd /tmp && git clone --depth=1 https://github.com/yappingboy/beck-cloud && cd beck-cloud && kustomize build flux/infrastructure/media/ > /dev/null 2>&1 && echo 'kustomize build OK' || echo 'kustomize build FAILED'"
```

Actually, since we haven't pushed yet, just validate locally:

```bash
cd /root/beck-cloud
# Check that kustomization references all exist
for f in $(grep '^  - ' flux/infrastructure/media/kustomization.yaml | sed 's/.*- //'); do
  if [ ! -f "flux/infrastructure/media/$f" ]; then
    echo "MISSING: $f"
  fi
done
echo "File check complete"
```

**Step 3: Commit**

```bash
git add flux/infrastructure/media/kustomization.yaml
git commit -m "chore: add jellyseerr-oidc secret to media kustomization"
```

---

## Task 7: Update Keycloak setup documentation

**Objective:** Document the new Keycloak client configuration steps so future operators can recreate or troubleshoot.

**Files:**
- Modify: `docs/keycloak-setup.md`

**Step 1: Add new section after section 2.5**

Append these sections to `docs/keycloak-setup.md`:

```markdown
### 2.6 Create the Jellyfin SAML Client

Jellyfin uses SAML 2.0 via the JellyfinSSO community plugin.

1. **Clients** → **Create client**
2. **Client type**: SAML
3. **Client ID**: `jellyfin`
4. Click **Next**

**Settings:**
| Field | Value |
|-------|-------|
| Root URL | `https://jellyfin.becklab.cloud` |
| Home URL | `https://jellyfin.becklab.cloud` |
| Base URL | `/` |
| Valid post redirect URIs | `https://jellyfin.becklab.cloud/*` |
| Client signature | On |
| Client authentication | On |
| Force POST bindings | On |

Click **Save**.

#### SAML Mappers

**Clients** → **jellyfin** → **Mappers** → Add three mappers:

1. **username** — User Property mapper:
   - User attribute: `username`
   - SAML attribute name: `username`
   - SAML attribute value: `${username}`

2. **email** — User Property mapper:
   - User attribute: `email`
   - SAML attribute name: `email`
   - SAML attribute value: `${email}`

3. **displayName** — User Property mapper:
   - User attribute: `firstName`
   - SAML attribute name: `displayName`
   - SAML attribute value: `${firstName}`

### 2.7 Create the Jellyseerr OIDC Client

Jellyseerr uses native OAuth2/OIDC authentication.

1. **Clients** → **Create client**
2. **Client type**: OpenID Connect
3. **Client ID**: `jellyseerr`
4. Click **Next**

**Capability config:**
- Client authentication: On
- Authorization: Off

**Login settings:**
| Field | Value |
|-------|-------|
| Valid redirect URIs | `https://requests.becklab.cloud/oauth2/oidc/callback` |

Click **Save**.

#### Assign Groups Scope

**Clients** → **jellyseerr** → **Client Scopes** tab → **Add client scope** → search `groups` → **Add** → choose **Default**.

#### Store the Client Secret

Copy the client secret from **Credentials** tab and update the SOPS-encrypted secret:

```bash
sops flux/infrastructure/media/secret-jellyseerr-oidc.yaml
```
```

**Step 2: Update the SSO verification section**

Update section 3 to include Jellyfin and Jellyseerr:

```markdown
## 3. Verify SSO

After completing the above:

1. Visit https://jellyfin.becklab.cloud — you should see the Jellyfin dashboard with a SAML login option (JellyfinSSO plugin).
2. Visit https://requests.becklab.cloud — you should be automatically redirected to Keycloak login (Jellyseerr native OIDC with OIDC_AUTO=true).
3. After logging into Keycloak, you should be redirected back and automatically logged in.
```

**Step 3: Commit**

```bash
git add docs/keycloak-setup.md
git commit -m "docs: add Jellyfin SAML and Jellyseerr OIDC Keycloak setup steps"
```

---

## Task 8: Push and deploy

**Objective:** Push all changes to the repo so Flux syncs them to the cluster.

**Step 1: Final review of all changes**

```bash
cd /root/beck-cloud
git log --oneline -5
# Should show commits for:
# - docs: add Jellyfin SAML and Jellyseerr OIDC Keycloak setup steps
# - chore: add jellyseerr-oidc secret to media kustomization
# - chore: remove oauth2-proxy middleware from jellyseerr ingress
# - feat: enable Jellyseerr native OIDC SSO with Keycloak
# - feat: add JellyfinSSO plugin init container and plugins volume
```

**Step 2: Push to remote**

```bash
git push origin main
```

**Step 3: Verify Flux syncs**

```bash
ssh -o StrictHostKeyChecking=no -i /root/.ssh/K3s ubuntu@192.168.100.10 "kubectl -n flux-system get gitrepositories,ks -o custom-columns='NAME:.metadata.name,READY:.status.conditions[?@.type==\"Ready\"].status,MESSAGE:.status.conditions[?@.type==\"Ready\"].message' 2>&1"
```

Wait for Flux to reconcile (usually 1-2 minutes).

**Step 4: Verify pods restart**

```bash
ssh -o StrictHostKeyChecking=no -i /root/.ssh/K3s ubuntu@192.168.100.10 "kubectl -n media rollout status deploy/jellyfin --timeout=120s && kubectl -n media rollout status deploy/jellyseerr --timeout=120s" 2>&1
```

**Step 5: Verify JellyfinSSO plugin loaded**

```bash
ssh -o StrictHostKeyChecking=no -i /root/.ssh/K3s ubuntu@192.168.100.10 'kubectl -n media exec deploy/jellyfin -- ls -la /config/plugins/' 2>&1
```

Should show `JellyfinSSO.dll`.

**Step 6: Check logs for errors**

```bash
ssh -o StrictHostKeyChecking=no -i /root/.ssh/K3s ubuntu@192.168.100.10 "kubectl -n media logs deploy/jellyfin --tail=30 2>&1; echo '==='; kubectl -n media logs deploy/jellyseerr --tail=30" 2>&1
```

Look for:
- Jellyfin: "JellyfinSSO" plugin loaded messages
- Jellyseerr: OIDC configuration messages, no errors about missing env vars

**Step 7: End-to-end test**

Open browser:
1. Navigate to https://requests.becklab.cloud → should redirect to Keycloak login
2. Log in with LLDAP-federated user
3. Should redirect back to Jellyseerr, logged in automatically
4. Navigate to https://jellyfin.becklab.cloud → should see Jellyfin dashboard with SAML login option

**Commit:** No new files — this is deployment verification only.

---

## Post-Deployment: Configure JellyfinSSO in Dashboard

After deployment, configure JellyfinSSO through the Jellyfin dashboard:

1. Open https://jellyfin.becklab.cloud
2. Go to **Dashboard** → **Plugins** → verify **JellyfinSSO** is installed and enabled
3. Go to **Dashboard** → **JellyfinSSO** settings:

| Setting | Value |
|---------|-------|
| SAML Identity Provider URL | `https://keycloak.becklab.cloud/realms/homelab/protocol/saml/jellyfin` |
| SAML Entity ID | `https://jellyfin.becklab.cloud/auth/realms/homelab` |
| SAML ACS URL | `https://jellyfin.becklab.cloud/auth/sso` |
| Username Claim | `username` |
| Email Claim | `email` |
| Display Name Claim | `displayName` |
| Auto-create users | On |
| Default policy | `User` (or `Administrator` for first admin) |

4. Save settings
5. Test: Click the SSO login button on the Jellyfin home page → should redirect to Keycloak → log in → redirect back to Jellyfin logged in

---

## Rollback Plan

If anything goes wrong:

```bash
# Revert Flux changes
cd /root/beck-cloud
git revert --no-commit HEAD~8..HEAD
# Manually resolve and commit
git commit -m "revert: Jellyfin/Jellyseerr SSO integration"
git push origin main

# Or manually revert on cluster:
kubectl -n media rollout undo deploy/jellyfin
kubectl -n media rollout undo deploy/jellyseerr
```

The oauth2-proxy-media instance remains untouched and can be re-added to Jellyseerr Ingress if needed as a temporary measure.

---

## Summary of Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `flux/infrastructure/media/secret-jellyseerr-oidc.yaml` | Create | SOPS-encrypted OIDC credentials for Jellyseerr |
| `flux/infrastructure/media/jellyfin.yaml` | Modify | Add plugins volume + init container for JellyfinSSO |
| `flux/infrastructure/media/jellyseerr.yaml` | Modify | Add OIDC env vars, remove SSO middleware from Ingress |
| `flux/infrastructure/media/kustomization.yaml` | Modify | Include new secret |
| `docs/keycloak-setup.md` | Modify | Document new Keycloak client setup |
