# GitOps & Automation Deep Dive

**Last audited:** 2026-07-20  
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
    ├── GitRepository: flux-system → revision main@sha1:c161d06cd29bb2caabcd037fd675a48646ea9c71
    │       │
    │       ├── Kustomization: flux-system (path=./flux, interval=10m)
    │       │     └── Applies: Flux system components + Helm repositories
    │       │
    │       ├── Kustomization: infrastructure (path=./flux/infrastructure, interval=1m)
    │       │     └── Applies: ALL services via nested kustomizations
    │       │           ├── identity/ (Keycloak, LLDAP, oauth2-proxy ×2, Redis, SSO middlewares, Postfix relay)
    │       │           ├── media/ (Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, etc.)
    │       │           ├── monitoring/ (Prometheus stack ingress)
    │       │           ├── webapps/ (Affine, Bitwarden, Directus, Home Assistant, Homepage, Landing, Silex, OpenClaw)
    │       │           ├── 3dprinting/ (Manyfold, FDM Monster, Spoolman, OrcaSlicer, BumpMesh)
    │       │           ├── gridspace/ (Gridspace, Kiri:moto, Mesh Tool, Void:Form)
    │       │           ├── gaming/ (Crafty Controller)
    │       │           ├── landing/ (Landing page, Silex — legacy, now in webapps)
    │       │           ├── llm/ (llama.cpp ExternalName, rho)
    │       │           ├── opennebula/ (Sunstone proxy)
    │       │           ├── security/ (Wazuh, Trivy Operator, Suricata)
    │       │           └── ... (various other namespaces)
    │       │
    │       ├── Kustomization: traefik-config (path=./flux/infrastructure/traefik-config, interval=5m)
    │       │     └── Applies: HTTPS redirect, security headers, Traefik dashboard route
    │       │
    │       ├── Kustomization: cert-manager-config (path=./flux/infrastructure/cert-manager-config, interval=5m)
    │       │     └── Applies: ClusterIssuer for Let's Encrypt production
    │       │
    │       └── Kustomization: apps (path=./flux/apps, interval=5m)
    │             └── Applies: Homepage (now in webapps), Toolbox, User-invite custom app
    │
    └── HelmRepository sources → jetstack, cilium, traefik, prometheus-community, vmware-tanzu, aquasecurity, etc.
            │
            ▼
        Flux Helm Controller (helm-controller:v1.1.0)
            └── Manages 10 HelmReleases across namespaces
```

### Kustomization Hierarchy

```
flux/infrastructure/kustomization.yaml  ← root kustomization
 ├── identity/ (namespace: identity)
 ├── media/ (namespace: media)
 ├── monitoring/ (namespace: monitoring, includes ingress routes)
 ├── webapps/ (namespace: webapps) ← NEW consolidation namespace
 ├── 3dprinting/ (namespace: 3dprinting) ← NEW
 ├── gridspace/ (namespace: gridspace) ← NEW
 ├── gaming/ (namespace: gaming)
 ├── llm/ (namespace: llm)
 ├── opennebula/ (namespace: opennebula)
 ├── security/ (namespace: security)
 └── ... (additional namespaces)

flux/apps/kustomization.yaml  ← apps kustomization
 ├── homepage/ (namespace: webapps) ← moved from homepage
 ├── toolbox/ (namespace: toolbox)
 └── user-invite/ (namespace: identity — cross-ns app)
```

### Helm Releases (10)

| Release | Namespace | Chart | Source Repository | Status |
|---------|-----------|-------|-------------------|--------|
| cert-manager | cert-manager | cert-manager v1.16.5 | jetstack | ✅ True |
| homepage | webapps | homepage | gethomepage | ✅ True |
| oauth2-proxy | identity | oauth2-proxy v7.6.0 | oauth2-proxy | ✅ True |
| oauth2-proxy-media | identity | oauth2-proxy v7.6.0 | oauth2-proxy | ✅ True |
| cilium | kube-system | cilium v1.17.0 | Cilium official repo | ✅ True |
| kube-prometheus-stack | monitoring | kube-prometheus-stack v65.5.0 | Prometheus Community repo | ✅ True |
| trivy-operator | security | trivy-operator v0.30.0 | Aqua Security | ✅ True |
| wazuh | security | wazuh v4.14.3 | Morgoved | ✅ True |
| traefik | traefik | traefik v36.3.0 | Traefik official repo | ✅ True |
| velero | velero | velero v8.0.0 | VMware Tanzu repo | ✅ True |

> **Changes since July 12:**
> - Homepage HelmRelease moved from `homepage` to `webapps` namespace
> - Trivy Operator HelmRelease moved from `trivy-system` to `security` namespace
> - Wazuh HelmRelease added (replacing older deployment)

### Flux Controller Versions

| Controller | Image | Version |
|-----------|-------|---------|
| source-controller | ghcr.io/fluxcd/source-controller:v1.4.1 | v1.4.1 |
| helm-controller | ghcr.io/fluxcd/helm-controller:v1.1.0 | v1.1.0 |
| kustomize-controller | ghcr.io/fluxcd/kustomize-controller:v1.4.0 | v1.4.0 |
| notification-controller | ghcr.io/fluxcd/notification-controller:v1.4.0 | v1.4.0 |

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

- **Rotation documented** in `docs/ansible/SOPS-ROTATION.md`
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
4. **Push target:** `ghcr.io/yappingboy/becklab-user-invite:v4.1783837566` (UPGRADED from v1)
5. **Deployed via Flux** from `flux/apps/user-invite/kustomization.yaml`

### gridspace App (Kaniko)

Custom Gridspace application also built in-cluster:

1. **Build pod:** `build-gridspace-fnzlz` (Completed, 3d6h ago)
2. **Push target:** `ghcr.io/yappingboy/becklab-gridspace:latest`
3. **Deployed in** `gridspace` namespace

### Build Script (offline use)

```bash
# From apps/user-invite/:
./build-and-push.sh
```

---

*End of GitOps & automation deep dive.*
