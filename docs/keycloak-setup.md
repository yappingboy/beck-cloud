# Keycloak + LLDAP Setup Guide

This guide covers the manual post-deploy configuration of LLDAP and Keycloak for the becklab SSO stack.
Both services are deployed by Flux but require one-time configuration through their UIs after first boot.

## Prerequisites

All Flux HelmReleases in the `identity` namespace must be `Ready`:

```bash
kubectl -n identity get helmreleases
```

## 1. LLDAP

LLDAP is a lightweight LDAP server. It handles users and groups. Keycloak federates against it.

### Access

https://lldap.becklab.cloud — log in with the credentials from `secret-lldap.yaml`
(plaintext: `LLDAP_LDAP_USER_PASS` in the SOPS-encrypted secret).

### Create Groups

Under **Groups → Add Group**, create:

| Group name |
|------------|
| `admins`   |
| `media`    |

### Create Users

Under **Users → Create a User**, create your account. Set a password under the user's **Set Password** tab.

Assign the user to groups from the **Groups** tab on the user detail page.

- `/admins` — access to admin-tier services (Traefik dashboard, Sonarr, Radarr, Prowlarr, Bazarr, Grafana, Wazuh, Rancher)
- `/media` — access to media-tier services (Jellyfin, Jellyseerr)

---

## 2. Keycloak

### Access

https://keycloak.becklab.cloud — log in with the credentials from `secret-keycloak.yaml`
(plaintext: `KEYCLOAK_ADMIN_PASSWORD`).

### 2.1 Create Realm

1. Click the realm dropdown (top-left, shows **master**) → **Create Realm**
2. Realm name: `homelab`
3. Click **Create**

### 2.2 Configure LDAP Federation

This tells Keycloak to use LLDAP as its user directory.

1. In the `homelab` realm → **User Federation** → **Add provider** → **LDAP**
2. Fill in:

| Field | Value |
|-------|-------|
| Vendor | Other |
| Connection URL | `ldap://lldap.identity.svc.cluster.local:389` |
| Bind DN | `uid=admin,ou=people,dc=becklab,dc=cloud` |
| Bind Credential | *(LLDAP admin password from secret)* |
| Users DN | `ou=people,dc=becklab,dc=cloud` |
| Username LDAP attribute | `uid` |
| RDN LDAP attribute | `uid` |
| UUID LDAP attribute | `entryUUID` |
| User Object Classes | `inetOrgPerson,organizationalPerson` |
| Edit Mode | READ_ONLY |

3. Click **Test connection** and **Test authentication** — both should pass.
4. Click **Save**.

#### Add Group Mapper

Still on the LDAP provider page → **Mappers** tab → **Add mapper**:

| Field | Value |
|-------|-------|
| Name | `groups` |
| Mapper Type | `group-ldap-mapper` |
| LDAP Groups DN | `ou=groups,dc=becklab,dc=cloud` |
| Group Name LDAP Attribute | `cn` |
| Group Object Classes | `groupOfUniqueNames` |
| Membership LDAP Attribute | `member` |
| Membership Attribute Type | `DN` |
| Mode | READ_ONLY |
| Drop non-existing groups during sync | On |

Click **Save**, then **Sync LDAP Groups to Keycloak** (button at the bottom of the mapper detail page).

After sync, verify under **Groups** in the realm — you should see `admins` and `media`.

Also trigger a user sync: on the LDAP provider main page → **Action** → **Sync all users**.

### 2.3 Create the oauth2-proxy Client

1. **Clients** → **Create client**
2. **Client type**: OpenID Connect
3. **Client ID**: use the value of `client-id` from the `oauth2-proxy-secrets` Kubernetes secret
4. Click **Next**

On the **Capability config** screen:
- **Client authentication**: On
- **Authorization**: Off
- Authentication flows: keep defaults (Standard flow enabled)

Click **Next**, then on **Login settings**:

| Field | Value |
|-------|-------|
| Valid redirect URIs | `https://oauth2.becklab.cloud/oauth2/callback` |
| | `https://oauth2-media.becklab.cloud/oauth2/callback` |
| Web origins | `https://oauth2.becklab.cloud` |
| | `https://oauth2-media.becklab.cloud` |

Click **Save**.

#### Copy the Client Secret

Go to the **Credentials** tab → copy the **Client secret**.

This value must match `client-secret` in the `oauth2-proxy-secrets` Kubernetes secret (SOPS-encrypted at
`flux/infrastructure/identity/secret-oauth2-proxy.yaml`). If it doesn't match, re-encrypt and push:

```bash
# Decrypt, edit client-secret, re-encrypt
sops flux/infrastructure/identity/secret-oauth2-proxy.yaml
git add flux/infrastructure/identity/secret-oauth2-proxy.yaml
git commit -m "chore: rotate oauth2-proxy client secret"
git push
```

### 2.4 Create the `groups` Client Scope

oauth2-proxy reads group membership from the `groups` claim in the OIDC token.
This requires a dedicated client scope with a group mapper — **not** a requested scope named `groups`.

1. **Client Scopes** → **Create client scope**

| Field | Value |
|-------|-------|
| Name | `groups` |
| Type | None (not default, not optional) |
| Protocol | openid-connect |
| Include in token scope | Off |

Click **Save**.

2. On the scope detail page → **Mappers** tab → **Add mapper** → **By configuration** → **Group Membership**

| Field | Value |
|-------|-------|
| Name | `groups` |
| Token Claim Name | `groups` |
| Full group path | On |
| Add to ID token | On |
| Add to access token | On |
| Add to userinfo | On |
| Add to token introspection | On |

Click **Save**.

### 2.5 Assign the `groups` Scope to the Client

1. Go to **Clients** → select your oauth2-proxy client
2. **Client Scopes** tab → **Add client scope**
3. Search for `groups`, select it, click **Add** → choose **Default**

Verify the `groups` claim appears: **Client Scopes** → **groups** → **Evaluate** tab, enter a username, and
click **Evaluate**. The generated token should contain a `groups` array like `["/admins"]`.

---

## 3. Verify SSO

After completing the above:

1. Visit a protected service, e.g. https://sonarr.becklab.cloud
2. You should be redirected to Keycloak → log in → redirected back and granted access.
3. A user in `/admins` gets access to admin-tier services; a user in `/media` gets access to media-tier services.

If access is denied, check:

```bash
# oauth2-proxy logs
kubectl -n identity logs -l app.kubernetes.io/name=oauth2-proxy --tail=50

# Traefik middleware resolution
kubectl -n identity get middleware
kubectl -n traefik get middleware
```

The SSO middlewares must be in the `identity` namespace (see `flux/infrastructure/identity/sso-middlewares.yaml`).
Traefik references them as `identity-sso-admin-chain@kubernetescrd` / `identity-sso-media-chain@kubernetescrd`.

---

## Troubleshooting

### `invalid_scope` from Keycloak

oauth2-proxy only requests `openid email profile` (configured in `configFile`). Do **not** add `groups` to
the `scope` line — the groups claim is delivered via the dedicated client scope mapper above, not as a
requested OIDC scope.

### Middlewares Not Found (404 on protected routes)

Check that `flux/infrastructure/traefik-config/kustomization.yaml` does **not** have a top-level
`namespace: traefik` override — that would relocate the identity middlewares to the wrong namespace.

### Users Not Syncing from LLDAP

Trigger a manual sync: Keycloak → **User Federation** → LDAP provider → **Action** → **Sync all users**.
Or wait for the scheduled sync interval (default: 1 hour).

### Keycloak Can't Connect to LLDAP

Verify the LLDAP pod is running and the service exists:

```bash
kubectl -n identity get pods -l app.kubernetes.io/name=lldap
kubectl -n identity get svc lldap
```

The LDAP port is **389** (not 3890).
