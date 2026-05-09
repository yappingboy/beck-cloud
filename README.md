# Beck Cloud — Private Cloud Platform

Production-grade private cloud on K3s + ZFS, managed via Flux CD GitOps.

## Architecture

| Layer | Component | Status |
|-------|-----------|--------|
| L1 | OS & Bootstrap (Ansible) | ✅ Playbooks ready |
| L2 | Sunbeam OpenStack (hypervisor) | ✅ Playbook ready |
| L3 | ZFS Storage + NFS exports | ✅ Pool plan + datasets + StorageClasses |
| L4 | K3s + Cilium (on Nova VMs) | ✅ Playbook ready |
| L5 | GitOps (Flux CD) | ✅ Bootstrap + Sources + Controllers + Configs |
| L6 | Traefik + cert-manager | ✅ HelmReleases + SSO middlewares |
| L7 | Identity (lldap + Keycloak + oauth2-proxy) | ✅ Full stack defined |
| L8 | Security (Wazuh + Falco) | ✅ HelmReleases defined |
| L9 | Rancher (Multi-tenancy) | ✅ HelmRelease + namespace |
| L10 | Media Platform (Jellyfin/Sonarr/Radarr/etc) | ✅ Full stack defined |
| L11 | LLM/AI | ⬛ Removed (deferred) — will revisit later |
| L12 | Backup (Velero + restic) | ✅ Full schedules, filesystem backup |

## Repository Structure

```
├── .sops.yaml                    # SOPS encryption rules
├── ansible/                      # Bootstrap playbooks
│   ├── ansible.cfg
│   ├── requirements.yml          # Galaxy collections (openstack.cloud etc.)
│   ├── group_vars/all.yml        # Variables
│   ├── inventory/hosts.yml       # hypervisor + k3s_nodes groups
│   ├── templates/                # Jinja2 templates
│   └── playbooks/
│       ├── 00-sunbeam.yml        # Sunbeam OpenStack bootstrap
│       ├── 01-os-prep.yml        # OS hardening, ZFS/KVM prerequisites
│       ├── 02-zfs.yml            # ZFS pools, datasets, NFS exports
│       ├── 03-nova-vms.yml       # Provision K3s Nova instances
│       ├── 04-k3s.yml            # K3s + Cilium on Nova VMs
│       ├── 05-flux.yml           # Flux CLI + GitOps bootstrap
│       └── 06-snapshotter.yml    # CSI snapshot CRDs
├── flux/
│   ├── apps/apps.yaml            # Application layer kustomization
│   └── infrastructure/
│       ├── sources/              # HelmRepository definitions
│       ├── controllers/          # Cilium, NFS provisioner
│       ├── configs/              # StorageClasses (nfs-k3s, nfs-media, nfs-bulk)
│       ├── csi-snapshotter/      # VolumeSnapshotClasses
│       ├── traefik/              # Traefik + SSO middlewares + dashboard
│       ├── cert-manager/         # cert-manager + ClusterIssuers
│       ├── identity/             # lldap, Keycloak, oauth2-proxy
│       ├── security/             # Wazuh + Falco
│       ├── llm-stack.disabled/   # LLM stack — deferred
│       ├── velero/               # Velero backup (restic filesystem backup)
│       ├── rancher/              # Rancher multi-tenancy
│       ├── media/                # Jellyfin, Sonarr, Radarr, etc.
│       └── flux-system/          # Flux bootstrap config
├── plan/
│   └── zfs-migration-plan.md     # Storage architecture + deployment sequence
└── README.md
```

## Deployment Sequence

```bash
# Install Ansible collections first
ansible-galaxy collection install -r ansible/requirements.yml

# 0. Bootstrap Sunbeam OpenStack on bare metal
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/00-sunbeam.yml

# 1. OS hardening + ZFS/KVM prerequisites
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-os-prep.yml

# 2. Create ZFS pools + NFS exports (add -e wipe_disks=true on first run)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/02-zfs.yml -e wipe_disks=true

# 3. Provision Nova VM instances
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-nova-vms.yml
# → Update inventory k3s_nodes IPs then continue

# 4. Install K3s + Cilium on Nova VMs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/04-k3s.yml

# 5. Bootstrap Flux
GITHUB_TOKEN=<token> ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/05-flux.yml

# 6. Install CSI snapshot CRDs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/06-snapshotter.yml
```

## Flux Dependency Chain

```
flux-system (bootstrap)
  └── infrastructure-sources (HelmRepos)
        └── infrastructure-controllers (Cilium, NFS provisioner)
              └── infrastructure-configs (StorageClasses)
                    └── infrastructure-apps (Traefik, cert-manager, identity, security, velero, rancher, media)
                          └── apps (deployment health checks)
```

## Services & URLs

| Service | URL | Auth |
|---------|-----|------|
| Traefik Dashboard | https://traefik.becklab.cloud | Keycloak SSO |
| Keycloak | https://keycloak.becklab.cloud | LDAP (lldap) |
| lldap | https://lldap.becklab.cloud | — |
| Jellyfin | https://jellyfin.becklab.cloud | OIDC |
| Sonarr | https://sonarr.becklab.cloud | Keycloak SSO |
| Radarr | https://radarr.becklab.cloud | Keycloak SSO |
| Prowlarr | https://prowlarr.becklab.cloud | Keycloak SSO |
| Bazarr | https://bazarr.becklab.cloud | Keycloak SSO |
| Jellyseerr | https://requests.becklab.cloud | OIDC |
| qBittorrent | https://qbittorrent.becklab.cloud | — |
| Wazuh | https://wazuh.becklab.cloud | — |
| Rancher | https://rancher.becklab.cloud | Keycloak SSO |

## Secrets Management

- SOPS with age encryption for Flux secrets
- Age key: `~/.config/sops/age/homelab.agekey`
- `.sops.yaml` rules defined for `flux/` and `tofu/` paths
- Kubernetes secrets created via `sops-age` controller

## Design Decisions

- **Sunbeam OpenStack**: KVM hypervisor layer; K3s runs on Nova VMs for isolation and snapshot support
- **ZFS RAIDZ2×2**: ~49.5TB usable from 13×5.5TB spinning disks + 9.1TB archive mirror; NVMe SLOG for write acceleration
- **NFS bridge**: ZFS datasets exported via NFS to Nova VMs; NFS subdir provisioner handles K8s PV lifecycle
- **No MicroCeph**: ZFS+NFS avoids Ceph complexity on a single node
- **Cilium over Flannel**: eBPF NetworkPolicy for torrent VPN isolation
- **Flux (pull)**: No external CI with cluster credentials
- **lldap**: Simpler than OpenLDAP, compatible with Keycloak
- **qBit + Gluetun**: Same Pod for VPN-only egress + kill-switch
- **Velero + restic**: Filesystem-level PV backup; no CSI snapshots needed with NFS storage
