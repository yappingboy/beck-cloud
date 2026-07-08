# GitOps & Automation Deep Dive

**Last audited:** 2026-07-08  
**Scope:** Flux CD pipeline, Ansible playbooks, SOPS encryption, CI/CD patterns

---

## Flux CD Pipeline Architecture

```
GitHub (yappingboy/beck-cloud)
    │
    │  SSH clone every 1m
    ▼
Flux Source Controller (source-controller:v1.4.1)
    │
    ├── GitRepository: flux-system → revision main@sha1:548ee9...
    │       │
    │       ├── Kustomization: flux-system (path=./flux, interval=10m)
    │       │     └── Applies: Flux system components + Helm repositories
    │       │
    │       ├── Kustomization: infrastructure (path=./flux/infrastructure, interval=1m)
    │       │     └── Applies: ALL services via nested kustomizations
    │       │           ├── identity/ (Keycloak, LLDAP, oauth2-proxy ×2, Redis, SSO middlewares)
    │       │           ├── media/ (Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, etc.)
    │       │           ├── monitoring/ (Prometheus stack ingress)
    │       │           ├── bitwarden/ (Vaultwarden BSM)
    │       │           ├── cms/ (Directus)
    │       │           ├── email/ (Postfix relay)
    │       │           ├── velero/minio/ (Backup storage)
    │       │           ├── gaming/ (Crafty Controller)
    │       │           ├── landing/ (Landing page, Silex)
    │       │           ├── llm/ (llama.cpp ExternalName, rho)
    │       │           ├── opennebula/ (Sunstone proxy)
    │       │           ├── spotweb/ (NZB search)
    │       │           ├── torrent/ (qBittorrent + Gluetun)
    │       │           ├── security/ (Wazuh)
    │       │           └── rancher/ (Rancher dashboard)
    │       │
    │       ├── Kustomization: traefik-config (path=./flux/infrastructure/traefik-config, interval=5m)
    │       │     └── Applies: HTTPS redirect, security headers, Traefik dashboard route
    │       │
    │       ├── Kustomization: cert-manager-config (path=./flux/infrastructure/cert-manager-config, interval=5m)
    │       │     └── Applies: ClusterIssuer for Let's Encrypt production
    │       │
    │       └── Kustomization: apps (path=./flux/apps, interval=5m)
    │             └── Applies: Homepage, Toolbox, User-invite custom app
    │
    └── HelmRepository sources → jetstack, cilium, traefik, prometheus-community, vmware-tanzu, etc.
            │
            ▼
        Flux Helm Controller (helm-controller:v1.1.0)
            └── Manages 8 HelmReleases across namespaces
```

### Kustomization Hierarchy

```
flux/infrastructure/kustomization.yaml  ← root kustomization
 ├── identity/ (namespace: identity)
 ├── media/ (namespace: media)
 ├── monitoring/ (namespace: monitoring, includes ingress routes only)
 ├── bitwarden/ (namespace: bitwarden)
 ├── cms/ (namespace: cms)
 ├── email/ (namespace: email)
 ├── velero/minio/ (namespace: velero)
 ├── gaming/ (namespace: gaming)
 ├── landing/ (namespace: landing)
 ├── llm/ (namespace: llm)
 ├── opennebula/ (namespace: opennebula)
 ├── spotweb/ (namespace: spotweb)
 ├── torrent/ (namespace: torrent)
 ├── security/ (namespace: security)
 └── rancher/ (namespace: rancher, likely disabled/not deployed)

flux/apps/kustomization.yaml  ← apps kustomization
 ├── homepage/ (namespace: homepage)
 ├── toolbox/ (namespace: toolbox)
 └── user-invite/ (namespace: identity — cross-ns app)
```

### Helm Releases

| Release | Namespace | Chart | Version | Source Repository | Last Status |
|---------|-----------|-------|---------|-------------------|-------------|
| cert-manager | cert-manager | cert-manager | v1.16.5 | jetstack (Bitnami/Jetstack) | ✅ Ready, 46d |
| homepage | homepage | homepage | 1.2.3 | gethomepage Helm repo | ✅ Ready, 46d |
| oauth2-proxy | identity | oauth2-proxy | 7.6.0 |/oauth2-proxy Helm repo | ✅ Ready, 45d |
| oauth2-proxy-media | identity | oauth2-proxy | 7.6.0 | /oauth2-proxy Helm repo | ✅ Ready, 45d |
| cilium | kube-system | cilium | 1.17.0 | Cilium official repo | ✅ Ready, 46d |
| kube-prometheus-stack | monitoring | kube-prometheus-stack | 65.5.0 | Prometheus Community repo | ✅ Ready, 46d |
| traefik | traefik | traefik | 36.3.0 | Traefik official repo | ✅ Ready, 46d |
| velero | velero | velero | 8.0.0 | VMware Tanzu repo | ✅ Ready, 38d |

### Disabled/Unused Components

- **llm-stack.disabled/** — Contains Flowise, LiteLLM, Ollama (multiple instances), Open WebUI — directory named `.disabled` so NOT applied by Flux
- **Rancher** — HelmRelease exists in `flux/infrastructure/rancher/` but no corresponding namespace or running pods visible

---

## Ansible Automation

### Playbook Execution Order

| # | Playbook | Purpose | Key Operations |
|---|----------|---------|---------------|
| 00 | `00-prereqs.yml` | Bootstrap prerequisites | Package installs, system prep |
| 01 | `01-zfs.yml` | ZFS storage layer | Pool creation, dataset provisioning |
| 01-alt | `01-lvm-storage.yml` | Alternative LVM storage | Volume group setup (if not using ZFS) |
| 01-alt2 | `01-raid-storage.yml` | Alternative RAID storage | mdadm array + filesystem setup |
| 02 | `02-opennebula.yml` | OpenNebula CE deployment | Frontend + KVM node, AIO mode |
| 03 | `03-harden.yml` | Security hardening | Firewall, SSH config, sysctl tuning |
| 04 | `04-one-vms.yml` | VM provisioning | Creates k3s-server and k3s-worker-1 via OpenNebula Sunbeam manifest template |
| 05 | `05-k3s.yml` | K3s cluster bootstrap | Install server + join worker, configure Cilium |
| 06 | `06-flux.yml` | GitOps installation | Deploy Flux CD, point to GitHub repo |
| 07 | `07-snapshotter.yml` | CSI Snapshotter setup | Volume snapshot CRDs and driver |
| 08 | `08-ai-sysadmin.yml` | AI sysadmin tooling | OpenClaw deployment, kubectl access, SOPS integration |
| 09 | `09-backup-media-nfs.yml` | NFS backup share | Expose media via NFS for off-cluster backups |
| 10 | `10-sops-rotate.yml` | SOPS key rotation | Age key rotation for encrypted secrets |
| 99 | `99-uninstall.yml` | Full teardown | Destroy everything in reverse order |

### Templates

| Template | Purpose |
|----------|---------|
| `templates/sunbeam-manifest.yaml.j2` | OpenNebula VM manifest (Sunbeam CLI) for K3s node provisioning |
| `templates/exports.j2` | Environment exports for cluster access (kubeconfig, etc.) |
| `templates/sops.yaml.j2` | SOPS configuration with age public keys |

### Inventory Configuration

- **Target host:** `homelab` → hostname `becklab`, SSH as root
- **K3s nodes** defined via ProxyJump pattern: worker reached through server
- **SSH key:** `$K3S_SSH_KEY` env var or default `/root/.ssh/K3s`
- **Python interpreter:** `/usr/bin/python3` on all targets

---

## SOPS Secret Encryption

### Configuration (`.sops.yaml`)

All secrets in the repository are encrypted with SOPS using age keys:

```yaml
# Secrets path: flux/**/secret*.yaml, ansible/**/secret*.yaml
# Encrypted with age public key(s) for authorized decryptors
```

- **Rotation documented** in `ansible/docs/SOPS-ROTATION.md`
- **Age keys** stored on the hypervisor host (`becklab`) and any machine that needs to decrypt secrets for GitOps operations
- Secrets are committed encrypted — plaintext never leaves authorized machines

### Key Secret Files (encrypted)

| File | Purpose |
|------|---------|
| `flux/infrastructure/identity/secret-keycloak.yaml` | Keycloak admin password, LDAP bind credential |
| `flux/infrastructure/identity/secret-lldap.yaml` | LLDAP admin password |
| `flux/infrastructure/identity/secret-oauth2-proxy.yaml` | oauth2-proxy cookies, config |
| `flux/infrastructure/identity/secret-redis.yaml` | Redis authentication |
| `flux/infrastructure/email/secret-mailgun.yaml` | Mailgun API key for outbound relay |
| `flux/infrastructure/media/secret-gluetun.yaml` | Gluetun VPN credentials |
| `flux/infrastructure/media/secret-recyclarr.yaml` | Recyclarr authentication tokens |
| `flux/infrastructure/media/secret-tdarr.yaml` | Tdarr Node auth |
| `flux/apps/user-invite/secret-user-invite.yaml` | User invite app secrets |

---

## Custom Application Build Process

### user-invite App (Kaniko)

The `user-invite` service is a custom Python application built with Kaniko inside the cluster:

1. **Source:** `apps/user-invite/` in the repo
2. **Dockerfile:** Builds Python app with dependencies
3. **Build:** `kaniko-build.yaml` triggers an in-cluster build to GHCR
4. **Push target:** `ghcr.io/yappingboy/becklab-user-invite:v1`
5. **Deployed via Flux** from `flux/apps/user-invite/kustomization.yaml`

### Build Script (offline use)

```bash
# From apps/user-invite/:
./build-and-push.sh
```

---

*End of GitOps & automation deep dive.*
