# BeckCloud — Private Cloud Platform

A production-grade homelab running on bare-metal hardware, virtualized through OpenNebula, hosting K3s Kubernetes with ~40 services managed entirely via Flux CD GitOps.

**Built by one. Running for all.**

---

## Architecture at a Glance

```
Bare Metal (AlmaLinux 9)
  → RAID6 (14× 6TB SAS, ~78TB) + LVM
    → OpenNebula 7.2 (KVM hypervisor)
      → K3s v1.32 + Cilium (2 VMs: 1 master, 1 worker)
        → Flux CD GitOps → ~40 services across 15 namespaces
```

## Key Numbers

| Metric | Value |
|--------|-------|
| Kubernetes | v1.32.0+k3s1 with Cilium CNI |
| Deployments | ~40 across 15 namespaces |
| HelmReleases | 11 (cert-manager, Traefik, Cilium, Prometheus, Velero, etc.) |
| TLS Certificates | 44 via cert-manager + Let's Encrypt |
| Backup Schedules | 5 (namespace-specific + weekly full-cluster) |

## Quick Links

| Resource | Link |
|----------|------|
| **Full documentation** | [docs/index.md](docs/index.md) |
| **Deployment runbook** | [docs/runbooks/deployment-runbook.md](docs/runbooks/deployment-runbook.md) |
| **System overview** | [docs/reference/system-overview.md](docs/reference/system-overview.md) |
| **Services catalog** | [docs/reference/services-catalog.md](docs/reference/services-catalog.md) |
| **Namespace descriptions** | [docs/reference/namespace-descriptions.md](docs/reference/namespace-descriptions.md) |
| **Maintenance SOPs** | [docs/maintenance/MAINTENANCE-SOP.md](docs/maintenance/MAINTENANCE-SOP.md) |
| **Brand guide** | [docs/brand/BRAND-GUIDE.md](docs/brand/BRAND-GUIDE.md) |

## Deployment

Bare-metal provisioning via Ansible, then GitOps via Flux CD:

```bash
# Provision bare metal (12 playbooks, sequential)
ansible-galaxy collection install -r ansible/requirements.yml
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/00-prereqs.yml
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-raid-storage.yml
# ... through 09-backup-media-nfs.yml
# Full sequence: see docs/runbooks/deployment-runbook.md

# Flux deploys everything else from flux/ directory automatically
```

## Secrets

SOPS with age encryption. Key at `secrets/homelab.agekey`. See [SOPS Rotation](docs/ansible/SOPS-ROTATION.md).

## Design Decisions

- **OpenNebula 7.2** — AIO KVM hypervisor; K3s on VMs for isolation
- **RAID6 + LVM** — ~78TB usable, tolerates 2 disk failures
- **Cilium** — eBPF networking with VPN kill-switch for torrent pods
- **Flux (pull)** — No external CI with cluster credentials
- **lldap + Keycloak** — Lightweight LDAP with full OAuth2/OIDC SSO
- **Velero + MinIO** — Multi-schedule backup strategy
