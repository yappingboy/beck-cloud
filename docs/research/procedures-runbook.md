# Procedures & Runbook

**Last audited:** 2026-07-20  
**Scope:** Operational procedures, common tasks, troubleshooting patterns

---

## Post-Deploy Checklist (Current Services)

*Consolidated from the legacy `docs/POST-DEPLOY-CHECKLIST.md`.
Updated to reflect current service state as of 2026-07-20.*

### DNS Records

All externally exposed services need A records pointing to your cluster public IP:

```
affine.becklab.cloud     -> <YOUR_PUBLIC_IP>
bw.becklab.cloud         -> <YOUR_PUBLIC_IP>
cms.becklab.cloud        -> <YOUR_PUBLIC_IP>
grafana.becklab.cloud    -> <YOUR_PUBLIC_IP>
ha.becklab.cloud         -> <YOUR_PUBLIC_IP>       (NEW — Home Assistant)
hubble.becklab.cloud     -> <YOUR_PUBLIC_IP>
kiri.becklab.cloud       -> <YOUR_PUBLIC_IP>       (NEW — Gridspace Kiri:moto)
mesh.becklab.cloud       -> <YOUR_PUBLIC_IP>       (NEW — Gridspace Mesh Tool)
nova.becklab.cloud       -> <YOUR_PUBLIC_IP>       (NEW — OpenClaw)
one.becklab.cloud        -> <YOUR_PUBLIC_IP>
silex.becklab.cloud      -> <YOUR_PUBLIC_IP>
traefik.becklab.cloud    -> <YOUR_PUBLIC_IP>
void.becklab.cloud       -> <YOUR_PUBLIC_IP>       (NEW — Gridspace Void:Form)
```

> Media services (jellyfin, sonarr, etc.) have TLS certificates but no IngressRoutes yet.
> DNS records for those can be added when routes are deployed.

### Verify Deployment

```bash
# Check all pods across namespaces
kubectl get pods -A

# Check specific namespaces
kubectl get pods -n identity    # Keycloak, LLDAP, oauth2-proxy ×2, Redis, logout-page, sso-redirect, user-invite, Postfix relay
kubectl get pods -n webapps     # Affine, Bitwarden BSM, Directus, Home Assistant, Homepage, Landing, Silex, OpenClaw
kubectl get pods -n media       # Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, qBittorrent+Gluetun, Homebox, Tdarr, Jellyseerr, SABnzbd, nzbget, SpotWeb, MariaDB
kubectl get pods -n monitoring  # Prometheus stack, Grafana
kubectl get pods -n security    # Wazuh stack, Suricata, Trivy Operator
kubectl get pods -n 3dprinting  # Manyfold, FDM Monster, Spoolman, OrcaSlicer, BumpMesh
kubectl get pods -n gridspace   # Gridspace, Kiri:moto, Mesh Tool, Void:Form
kubectl get pods -n gaming      # Crafty Controller (Minecraft)
```

### Check IngressRoutes

```bash
kubectl get ingressroute -A
```

Expected routes:
| Route | Namespace |
|-------|-----------|
| affine | webapps |
| bitwarden-secrets-manager | webapps |
| directus | webapps |
| grafana | monitoring |
| home-assistant | webapps |
| hubble-ui | monitoring |
| kiri-moto | gridspace |
| mesh-tool | gridspace |
| openclaw | webapps |
| opennebula | opennebula |
| silex | webapps |
| traefik-dashboard-https | traefik |
| void-form | gridspace |

### First-Time Setup

| Service | URL | Initial Action |
|---------|-----|----------------|
| Affine | https://affine.becklab.cloud | SSO login (admin tier), create workspace |
| Bitwarden BSM | https://bw.becklab.cloud | Create admin account, set up projects |
| Directus | https://cms.becklab.cloud | SSO login, configure collections |
| Home Assistant | https://ha.becklab.cloud | SSO login (admin tier, no-auth-header variant) |
| Grafana | https://grafana.becklab.cloud | SSO login (admin tier) |
| Hubble UI | https://hubble.becklab.cloud | SSO login, view network map |
| OpenNebula Sunstone | https://one.becklab.cloud | SSO login |
| OpenClaw | https://nova.becklab.cloud | SSO login (admin tier) |
| Silex | https://silex.becklab.cloud | SSO login, run setup wizard if first time |
| Traefik Dashboard | https://traefik.becklab.cloud | SSO login (admin tier) |

### SOPS Key Management

The SOPS age private key lives at:
```
/root/beck-cloud/.sops.agekey
```

Copy to your workstation for future secret edits:
```bash
scp root@becklab:/root/beck-cloud/.sops.agekey ~/.config/sops/age/becklab.agekey
```

### Email Deliverability (Postfix Relay)

The Postfix relay now runs in the `identity` namespace (moved from `email` via Mailgun). No full mail server.
For services that send email through the cluster:

1. **SPF record** — Add TXT record for `becklab.cloud`:
   ```
   v=spf1 include:mailgun.org ~all
   ```
2. **DMARC record** — Add TXT record for `_dmarc.becklab.cloud`:
   ```
   v=DMARC1; p=none; rua=admin@becklab.cloud
   ```

> The legacy Mailu setup (full email server with IMAP/SMTP) was removed.
> Current setup is outbound-only relay via Mailgun.

---

## Access Patterns

### SSH Access to K3s Nodes

```bash
# Direct access to master (from hypervisor or LAN with key)
ssh -i /root/.ssh/K3s ubuntu@172.16.0.20

# Access to worker (via ProxyJump through master)
ssh -J ubuntu@172.16.0.20 ubuntu@192.168.100.11
```

### kubectl Context

kubeconfig should be on the OpenClaw host and any Ansible control plane:
- API server: `https://172.16.0.20:6443`
- Both nodes are in the same cluster context

### SOPS Decryption

```bash
# Decrypt a secret (requires age private key on the machine)
sops decrypt flux/infrastructure/identity/secret-keycloak.yaml

# Edit encrypted secrets safely
sops flux/infrastructure/media/secret-gluetun.yaml  # auto-encrypts on save
```

### Keycloak Service Account for Authenticated API Testing

Use via `grant_type=password` through Traefik:
- **Realm:** homelab
- **Token URL:** `https://keycloak.becklab.cloud/realms/homelab/protocol/openid-connect/token`
- See TOOLS.md for monitoring client credentials (Nova's own token)

---

## Common Operations

### Adding a New Service

1. Create Flux manifest in appropriate namespace under `flux/infrastructure/<namespace>/`
2. Define Deployment, Service, and optionally IngressRoute
3. Add to namespace kustomization.yaml `resources:` list
4. Commit and push — Flux picks it up within 1 minute (infrastructure kustomization interval)

```yaml
# Example: flux/infrastructure/webapps/new-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-service
  namespace: webapps
spec:
  replicas: 1
  selector:
    matchLabels:
      app: new-service
  template:
    metadata:
      labels:
        app: new-service
    spec:
      containers:
      - name: new-service
        image: lscr.io/example/service:latest
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: new-service
  namespace: webapps
spec:
  selector:
    app: new-service
  ports:
  - port: 8080
    targetPort: 8080
```

### Adding a New IngressRoute with SSO

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: new-service
  namespace: webapps
spec:
  entryPoints:
  - websecure
  routes:
  - kind: Rule
    match: Host(`newservice.becklab.cloud`)
    middlewares:
    - name: sso-admin-chain      # or sso-media-chain for media tier
      namespace: identity
    services:
    - name: new-service
      port: 8080
  tls:
    secretName: new-service-tls
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: new-service
  namespace: webapps
spec:
  secretName: new-service-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - newservice.becklab.cloud
```

### Adding an Encrypted Secret

1. Create the secret YAML with plaintext values
2. Add path pattern to `.sops.yaml` if not covered by existing globs
3. Run `sops --encrypt-in-place <file>`
4. Commit encrypted file (plaintext never appears in git history)

```bash
# Example
cp flux/infrastructure/webapps/new-secret.yaml.template flux/infrastructure/webapps/new-secret.yaml
# Fill in values, then:
sops --encrypt-in-place flux/infrastructure/webapps/new-secret.yaml
git add flux/infrastructure/webapps/new-secret.yaml
```

### Rolling Restart of a Deployment

```bash
kubectl rollout restart deployment/<name> -n <namespace>
kubectl rollout status deployment/<name> -n <namespace>
```

### Checking Service Health

```bash
# Quick health check across all namespaces
kubectl get pods -A --field-selector=status.phase!=Running

# Check a specific service
kubectl logs -n media deploy/jellyfin --tail=50
kubectl describe pod -n media -l app=jellyfin
```

### Port Forwarding to Internal Services

```bash
# Access Jellyfin Web UI locally
kubectl port-forward -n media svc/jellyfin 8096:8096
# → http://localhost:8096

# Access Sonarr
kubectl port-forward -n media svc/sonarr 8989:8989

# Access qBittorrent (moved from torrent namespace)
kubectl port-forward -n media svc/qbit-gluetun 8080:8080

# Access Grafana (already exposed but useful for quick access)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

### Velero Backup Operations

```bash
# Check backup status
kubectl get backups -n velero --sort-by=.metadata.creationTimestamp

# Check schedules
kubectl get schedules -n velero

# Trigger manual backup of a namespace
velero backup create webapps-backup-$(date +%Y%m%d) --include-namespaces webapps

# Restore from backup (if needed)
velero restore create --from-backup <backup-name> --namespace-mappings source=destination
```

### Certificate Management

```bash
# Check all certificates
kubectl get certificates -A

# Force certificate renewal
kubectl patch certificate -n <ns> <cert-name> -p '{"metadata":{"annotations":{"cert-manager.io/renew-on-update":"True"}}}'

# Check ClusterIssuer status
kubectl describe clusterissuer letsencrypt-prod
```

---

## Troubleshooting Patterns

### Service Not Starting

1. `kubectl describe pod -n <ns> <pod>` — check events for mount/auth/image errors
2. `kubectl logs -n <ns> <pod>` — application-level errors
3. Check PVC binding: `kubectl get pvc -n <ns>` — if Pending, storage class or PV issue
4. Check node resources: `kubectl top nodes` — OOM kills show up here

### SSO Not Working

1. Verify oauth2-proxy pods are running: `kubectl get pods -n identity`
2. Check Keycloak is accessible: `kubectl port-forward -n identity svc/keycloak 8080:8080` then test at localhost:8080
3. Verify LLDAP federation in Keycloak admin console (User Federation → LDAP)
4. Check Redis for session issues: `kubectl get pods -n identity -l app=redis`

### Certificates Not Issuing

1. Check ClusterIssuer: `kubectl describe clusterissuer letsencrypt-prod` — look for ACME errors
2. Verify DNS resolves: `dig newservice.becklab.cloud` — must point to correct IP before cert issues
3. Check Traefik is serving on :443 and challenge requests can reach it

### Media Service Can't Write to Library

1. Check PV status: `kubectl get pv | grep media-` — should be Bound
2. Verify mount paths in deployment YAML match PVC claims
3. Check permissions inside the pod: `kubectl exec -n media deploy/jellyfin -- ls -la /path/to/library`

### Pod Stuck on Worker Node

1. `kubectl describe node ip-192-168-100-11` — check conditions, disk pressure, memory
2. `kubectl top node ip-192-168-100-11` — resource utilization
3. If worker is unreachable: try SSH via ProxyJump from Ansible host

### Trivy Operator Failing to Schedule

The security namespace has a ResourceQuota (`security-quota`) limiting CPU to 7000m.
Wazuh stack already uses ~7300m, leaving no room for Trivy's 500m request.

```bash
# Check quota usage
kubectl describe resourcequota security-quota -n security

# Options:
# 1. Increase the quota limit
# 2. Reduce Wazuh resource limits
# 3. Move Trivy to a different namespace
```

---

## Flux Operations

### Check Sync Status

```bash
# All kustomizations
kubectl get kustomization -n flux-system

# Git repository status
kubectl get gitrepository -n flux-system

# Specific release status
kubectl get helmrelease -A

# Detailed event log for a specific sync
kubectl describe kustomization infrastructure -n flux-system
```

### Pause/Resume Sync

```bash
# Pause a kustomization (prevents changes)
kubectl annotate kustomization infrastructure -n flux-system --remove=kubectl.kubernetes.io/last-applied-configuration --local --overwrite

# Or pause at the GitRepo level
kubectl patch gitrepository flux-system -n flux-system --type merge -p '{"spec":{"suspend":true}}'

# Resume
kubectl patch gitrepository flux-system -n flux-system --type merge -p '{"spec":{"suspend":false}}'
```

### Manual Reconcile (Force Sync)

```bash
# Force Flux to re-pull from Git and apply
kubectl annotate kustomization infrastructure -n flux-system force-sync="$(date +%s)"
```

---

## Ansible Operations

```bash
# Run a specific playbook
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-harden.yml

# Dry-run (check mode)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/05-k3s.yml --check

# Target specific host group
ansible-playbook -i ansible/inventory/hosts.yml -l k3s_nodes ansible/playbooks/05-k3s.yml
```

---

## Disaster Recovery Priorities

1. **Identity namespace** (backed up every 6h, 30d retention) — Most critical, contains all auth data
2. **Security namespace** (daily at 02:00, 90d retention) — Wazuh security monitoring
3. **Webapps namespace** (covered by weekly full-cluster backup) — User-facing services
4. **Media + Torrent namespaces** (daily at 01:00, 14d retention) — Service configs and databases
5. **Full cluster weekly backup** (Sunday 02:00, 90d retention) — Everything

### Media Library Recovery Note

The ~140 TiB of actual media files (movies/shows/anime) are NOT backed up by Velero. If the LVM volumes on k3s-server fail, those files are lost unless you have an off-cluster backup solution. Consider:
- NFS export via playbook `09-backup-media-nfs.yml` for rsync/sync to external storage
- Periodic sync to a cold storage target

---

*End of procedures & runbook.*
