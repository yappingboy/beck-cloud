# Becklab User Invite Tool

Admin-only web app for inviting users to Becklab services.

## What It Does

1. **Dashboard** at `https://admin.becklab.cloud` (behind oauth2-proxy, `/admins` group only)
2. **"Invite User" form** — enter username, email, display name, select groups
3. On submit:
   - Creates user in LLDAP via GraphQL API
   - Sets a random 16-character password
   - Adds to selected groups (fetched live from LLDAP)
   - Sends HTML invitation email via Postfix relay with credentials + Keycloak account link

## Architecture

```
Browser → Traefik → oauth2-proxy (/admins check) → user-invite Flask app
                                                        ↓
                                               LLDAP GraphQL API
                                                        ↓
                                          Postfix relay (smtp-relay.email)
                                              ↓
                                        Mailgun → user's email
```

## Deploy Steps

### 1. Build & Push Image

On any machine with Docker:

```bash
cd apps/user-invite/
./build-and-push.sh ghcr.io/YOURUSER/becklab-user-invite:v1
```

Or manually:

```bash
docker build -t ghcr.io/YOURUSER/becklab-user-invite:v1 .
docker push ghcr.io/YOURUSER/becklab-user-invite:v1
# Edit flux/apps/user-invite/deployment.yaml to update the image reference
```

### 2. Configure Registry Auth (if using private registry)

If pushing to a private registry, create an `imagePullSecret`:

```bash
kubectl -n identity create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=YOURUSER \
  --docker-password=TOKEN \
  --docker-email=you@example.com
```

Add to the deployment spec: `imagePullSecrets: [{name: regcred}]`

### 3. Commit & Deploy

Everything is wired into Flux via `flux/apps/user-invite/`:

```bash
git add flux/apps/user-invite/ apps/user-invite/
git commit -m "feat: deploy user-invite admin tool"
git push
```

Flux will pick up the changes automatically. Cert-Manager provisions the TLS cert for `admin.becklab.cloud`.

### 4. DNS

`admin.becklab.cloud` already resolves (CNAME → becklab.cloud). If you change the hostname, update the Ingress and add a DNS record.

## Files

| File | Purpose |
|------|---------|
| `app.py` | Flask application |
| `Dockerfile` | Container image build |
| `build-and-push.sh` | Build + push helper script |
| `deployment.yaml` | K8s Deployment, Service, Ingress, Secret (source) |
| `flux/apps/user-invite/` | Flux-deployed manifests (includes SOPS-encrypted secret) |

## Environment Variables

All set in the Deployment manifest:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLDAP_URL` | `http://lldap.identity.svc.cluster.local:17170` | LLDAP web API URL |
| `LLDAP_ADMIN_USER` | `admin` | LLDAP admin username |
| `LLDAP_ADMIN_PASS` | from `lldap-admin-password` secret | LLDAP admin password |
| `SMTP_HOST` | `smtp-relay.email.svc.cluster.local` | Outbound SMTP relay |
| `SMTP_PORT` | `25` | SMTP port |
| `FROM_EMAIL` | `invites@becklab.cloud` | Sender address |
| `KEYCLOAK_URL` | `https://keycloak.becklab.cloud` | Keycloak URL for invite emails |

## Testing Locally

```bash
# Set required env vars
export LLDAP_URL=http://lldap.identity.svc.cluster.local:17170
export LLDAP_ADMIN_USER=admin
export LLDAP_ADMIN_PASS=<password>
export SMTP_HOST=localhost  # or any local SMTP for testing
export FLASK_SECRET_KEY=test

pip install flask requests
python app.py
```

Visit `http://localhost:8000` (no SSO when running locally).
