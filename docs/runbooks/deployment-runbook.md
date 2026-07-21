# Full Deployment Runbook — Bare Metal to Running System

**Last updated:** 2026-07-21  
**Scope:** Complete end-to-end deployment from bare-metal hardware to all services running

---

## Prerequisites

### Hardware

| Component | Specification |
|-----------|---------------|
| Hypervisor host | x86_64 server with 14× 6TB HGST SAS drives, GPU (NVIDIA), minimum 32GB RAM |
| OS | AlmaLinux 9 (OpenNebula CE 7.2 ISO recommended) |
| Network | Static IP, DNS configured for `becklab.cloud` domain |
| External backup drive | USB/SATA drive for NFS media backup |

### Software & Accounts

- **GitHub account** with repository access to `yappingboy/beck-cloud`
- **GITHUB_TOKEN** with repo read/write access (for Flux)
- **Ansible** installed on control machine
- **kubectl** installed and configured
- **SOPS + age** installed for secret management

---

## Phase 1: Bare-Metal Provisioning (Ansible)

All playbooks run from the control machine against `ansible/inventory/hosts.yml`.

### 0. Prerequisites

```bash
cd /path/to/beck-cloud
ansible-galaxy collection install -r ansible/requirements.yml
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/00-prereqs.yml
```

Installs required packages, configures KVM, disables swap, loads kernel modules, sets NTP.

### 1. RAID6 + LVM Storage

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-raid-storage.yml
```

Builds `/dev/md0` (RAID6, ~78TB usable) → `vg_tank` → `lv_tank` → mounted as OpenNebula Tank datastore.

### 2. OpenNebula 7.2

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/02-opennebula.yml
```

Configures OpenNebula AIO (frontend + KVM node), bridge networking, NAT. Packages pre-installed by CE ISO.

### 3. Host Hardening

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-harden.yml
```

UFW firewall, sysctl tuning, SSH hardening, optional NVIDIA drivers.

### 4. K3s VMs via OpenNebula

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/04-one-vms.yml
```

Provisions K3s master and worker VMs on OpenNebula (Ubuntu 24.04). Uses `sunbeam-manifest.yaml.j2` template.

### 5. K3s + Cilium Installation

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/05-k3s.yml
```

Installs K3s v1.32.0 with Cilium CNI on all VM instances.

### 6. Flux CD Bootstrap

```bash
export GITHUB_TOKEN=your_token_here
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/06-flux.yml
```

Installs Flux CLI and bootstraps GitOps. This pulls manifests from `flux/` directory in this repo.

### 7. CSI Snapshot CRDs

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/07-snapshotter.yml
```

Installs VolumeSnapshot CRDs required for Velero backups.

### 8. AI Sysadmin (Optional)

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/08-ai-sysadmin.yml
```

Deploys Llamactl + Llama-server (CUDA) on the hypervisor host. Runs on GPU, separate from K3s.

### 9. Backup Media via NFS (Optional)

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/09-backup-media-nfs.yml
```

Mounts external backup drive and exports via NFS to media namespace.

### 10. SOPS Key Rotation

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/10-sops-rotate.yml
```

Generates new age keypair, re-encrypts all secrets, commits, and pushes. Run before re-running playbook 06 if keys changed.

### 11. OpenNebula LDAP Auth

```bash
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/11-opennebula-ldap.yml
```

Wires OpenNebula Sunstone/FireEdge to LLDAP for authentication.

---

## Phase 2: Flux GitOps Deployment

After Ansible playbooks 00-07 complete, Flux automatically deploys the following from the `flux/` directory:

### Flux Dependency Chain

```
flux-system (bootstrap)
  └── infrastructure-sources (HelmRepository definitions)
        └── infrastructure-controllers (Cilium, NVIDIA device plugin)
              └── infrastructure-configs (StorageClasses, CoreDNS)
                    └── infrastructure-apps (all namespace manifests)
                          ├── cert-manager
                          ├── traefik
                          ├── identity (Keycloak, LLDAP, oauth2-proxy)
                          ├── security (Wazuh, Suricata, Trivy)
                          ├── crowdsec
                          ├── media (Jellyfin stack)
                          ├── webapps (Affine, Bitwarden, etc.)
                          ├── monitoring (Prometheus, Grafana)
                          ├── velero
                          ├── gaming
                          ├── 3dprinting
                          └── gridspace
                          └── apps (user-invite, toolbox)
```

### Verify Deployment

```bash
# Check Flux sync status
kubectl get kustomization -n flux-system

# Check all pods
kubectl get pods -A

# Check HelmReleases
kubectl get helmrelease -A

# Check TLS certificates
kubectl get certificates -A
```

---

## Phase 3: Post-Deploy Configuration

### DNS Records

Point the following A records to your public IP:

- `*.becklab.cloud` (wildcard recommended) or individual records for each service

### Keycloak + LLDAP Setup

Follow the [Keycloak Setup Guide](../keycloak-setup.md) to configure:

1. LLDAP user/group creation
2. Keycloak realm and LDAP federation
3. oauth2-proxy client configuration
4. Group-based access control

### SOPS Key Setup

Copy your age key to the hypervisor:

```bash
scp ~/.config/sops/age/homelab.agekey becklab:/root/beck-cloud/secrets/homelab.agekey
```

---

## Phase 4: Verification Checklist

### Infrastructure

- [ ] RAID6 array healthy: `cat /proc/mdstat`
- [ ] LVM volumes active: `vgs && lvs`
- [ ] OpenNebula VMs running: `onevm list`
- [ ] K3s nodes ready: `kubectl get nodes`
- [ ] Cilium CNI active: `cilium status`

### Services

- [ ] All pods running: `kubectl get pods -A` (no CrashLoopBackOff)
- [ ] Traefik routes working: `kubectl get ingressroute -A`
- [ ] TLS certificates issued: `kubectl get certificates -A` (all Ready=true)
- [ ] Keycloak accessible: `https://keycloak.becklab.cloud`
- [ ] LLDAP accessible: `https://lldap.becklab.cloud`
- [ ] Grafana accessible: `https://grafana.becklab.cloud`

### Backups

- [ ] Velero schedules created: `kubectl get schedules -n velero`
- [ ] Test backup completed: `kubectl get backups -n velero`
- [ ] MinIO accessible (if configured)

### Security

- [ ] Wazuh dashboard accessible: `https://wazuh.becklab.cloud`
- [ ] Crowdsec bouncer active: `kubectl get pods -n crowdsec`
- [ ] Trivy Operator scanning: `kubectl get trivyoperatorconfig -n security`

---

## Troubleshooting

See [Procedures & Runbook](procedures-runbook.md) for common issues and resolutions.

### Quick Diagnostics

```bash
# Flux sync errors
kubectl logs -n flux-system -l app=helm-controller --tail=50

# Pod crash loops
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous

# Certificate issues
kubectl describe certificate <cert-name> -n <namespace>

# DNS resolution inside cluster
kubectl run -it --rm debug --image=busybox -- nslookup <hostname>
```
