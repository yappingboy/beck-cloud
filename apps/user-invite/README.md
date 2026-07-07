# User Invite Tool

Admin dashboard for inviting users to BeckCloud services. Creates accounts in LLDAP, sends invite emails, and gates everything behind Keycloak SSO.

## What It Does

- Admin form at `admin.becklab.cloud` (behind oauth2-proxy, `/admins` group only)
- Enter username, email, display name, select groups (fetched live from LLDAP)
- On submit: creates user in LLDAP → sets random password → adds to groups → sends invite email via Postfix relay
- Invitee gets credentials + link to Keycloak account page to set their own password

## Deploying

### 1. Build the image with Kaniko (in-cluster, no Docker needed)

The kaniko Job is already configured in `flux/apps/toolbox/` and will be deployed by Flux automatically when you commit this PR:

```
flux/apps/user-invite/kaniko-build.yaml   ← The kaniko Job definition
flux/apps/user-invite/secret-ghcr-credentials.yaml  ← GHCR push credentials (SOPS encrypted)
flux/apps/toolbox/kustomization.yaml       ← Deploys kaniko job + secret to 'toolbox' namespace
```

Flux will:
1. Create the `toolbox` namespace
2. Deploy the `build-user-invite` Job with kaniko
3. Kaniko fetches source from GitHub, builds the Dockerfile, pushes to `ghcr.io/yappingboy/becklab-user-invite`

### 2. Flux deploys everything else

After the image is pushed, Flux deploys:
- Deployment + Service in `identity` namespace
- Ingress at `admin.becklab.cloud` (TLS via cert-manager)
- SOPS-encrypted secrets (Flask session key + GHCR credentials)

### 3. Verify

```bash
# Check kaniko job completed
kubectl get jobs -n toolbox

# Check the app is running
kubectl get pods -n identity -l app=user-invite

# Visit https://admin.becklab.cloud
```

## Alternative: Build locally with Docker

If you prefer to build manually instead of using kaniko:

```bash
cd apps/user-invite/
./build-and-push.sh ghcr.io/yappingboy/becklab-user-invite:v1
```

Then commit the updated manifest. The kaniko job will still run but the image already exists, so it's just extra work — you can delete it afterward:

```bash
kubectl delete -f flux/apps/user-invite/kaniko-build.yaml -n toolbox
```

## Tech Stack

- **Backend:** Python 3.12 + Flask
- **Auth:** oauth2-proxy → Keycloak SSO (admins group only)
- **User DB:** LLDAP (GraphQL API)
- **Email:** Postfix relay via Mailgun
- **Deploy:** Flux CD + kustomize + SOPS

## Environment Variables

| Variable | Source | Description |
|---|---|---|
| `LLDAP_URL` | Hardcoded | LLDAP internal service URL |
| `LLDAP_ADMIN_USER` | Hardcoded | Admin username for LLDAP API |
| `LLDAP_ADMIN_PASS` | Secret: `lldap-admin-password` | Admin password (reuses existing secret) |
| `SMTP_HOST` | Hardcoded | Postfix relay service |
| `SMTP_PORT` | Hardcoded | SMTP port (25, unencrypted internal) |
| `FROM_EMAIL` | Hardcoded | Sender address for invite emails |
| `KEYCLOAK_URL` | Hardcoded | Keycloak public URL |
| `FLASK_SECRET_KEY` | Secret: `user-invite-secrets` | Flask session signing key (SOPS encrypted) |
