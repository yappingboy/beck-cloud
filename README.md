# Beck Cloud — Private Cloud Platform

Production-grade private cloud on K3s + ZFS, managed via Flux CD GitOps.

## Architecture

| Layer | Component | Status |
|-------|-----------|--------|
| L1 | OS & Bootstrap (Ansible) | ✅ Playbooks ready |
| L2 | K3s + Cilium | ✅ HelmRelease defined |
| L3 | ZFS Storage + Local Path Provisioner | ✅ Pool plan + datasets + StorageClasses |
| L4 | GitOps (Flux CD) | ✅ Bootstrap + Sources + Controllers + Configs |
| L5 | Traefik + cert-manager | ✅ HelmReleases + SSO middlewares |
| L6 | Identity (lldap + Keycloak + oauth2-proxy) | ✅ Full stack defined |
| L7 | Security (Wazuh + Falco) | ✅ HelmReleases defined |
| L8 | Rancher (Multi-tenancy) | ✅ HelmRelease + namespace |
| L9 | Media Platform (Jellyfin/Sonarr/Radarr/etc) | ✅ Full stack defined |
| L10 | LLM/AI | ⬛ Removed (deferred) — will revisit later |
| L11 | Backup (Velero) | ✅ Full schedules + snapshot classes |
| L12 | VM Test Overlay | ⬜ Not yet implemented |

## Repository Structure

```
├── .sops.yaml                    # SOPS encryption rules
├── ansible/                      # Bootstrap playbooks
│   ├── ansible.cfg
│   ├── group_vars/all.yml        # Variables
│   ├── inventory/hosts.yml       # Production inventory
│   └── playbooks/
│       ├── 01-os-prep.yml        # OS hardening, NVIDIA, disk wipe
│       ├── 02-k3s.yml            # K3s + Cilium + NVIDIA plugin
│       ├── 03-flux.yml           # Flux CLI + GitOps bootstrap
│       └── 04-snapshotter.yml    # CSI snapshot CRDs
├── flux/
│   ├── apps/apps.yaml            # Application layer kustomization
│   └── infrastructure/
│       ├── sources/              # HelmRepository definitions
│       ├── controllers/          # Cilium, ZFS/local-storage, NVIDIA plugin
│       ├── configs/              # ZFS datasets, StorageClasses
│       ├── csi-snapshotter/      # VolumeSnapshotClasses
│       ├── traefik/              # Traefik + SSO middlewares + dashboard
│       ├── cert-manager/         # cert-manager + ClusterIssuers
│       ├── identity/             # lldap, Keycloak, oauth2-proxy
│       ├── security/             # Wazuh + Falco
│       ├── llm-stack.disabled/   # LLM stack — deferred (new direction)
│       ├── velero/               # Velero backup
│       ├── rancher/              # Rancher multi-tenancy
│       ├── media/                # Jellyfin, Sonarr, Radarr, etc.
│       └── flux-system/          # Flux bootstrap config
├── tofu/                         # OpenTofu modules (Keycloak, Rancher)
├── bootstrap/                    # Ubuntu autoinstall config
├── scripts/                      # Helper scripts
├── docs/                         # Documentation
└── README.md
```

## Deployment Sequence

1. **Manual (current state):**
   - K3s is installed and running (`k3s version: v1.31.4+k3s1`)
   - Apply Flux manifests directly: `flux apply -f flux/`
   - Flux bootstrapped to GitHub: `yappingboy/beck-cloud`

2. **Full automation (future):**
   ```bash
   # 1. Bootstrap OS
   ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-os-prep.yml
   
   # 2. Install K3s + Cilium
   ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/02-k3s.yml
   
   # 3. Bootstrap Flux
   ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-flux.yml
   
   # 4. Install CSI snapshots
   ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/04-snapshotter.yml
   ```

## Flux Dependency Chain

```
flux-system (bootstrap)
  └── infrastructure-sources (HelmRepos)
        └── infrastructure-controllers (Cilium, ZFS/local-storage, NVIDIA)
              └── infrastructure-configs (ZFS datasets, StorageClasses)
                    └── infrastructure-apps (Traefik, cert-manager, identity, security, velero, rancher, media)
                          └── apps (deployment health checks)
```

## Services & URLs

| Service | URL | Auth |
|---------|-----|------|
| Traefik Dashboard | https://traefik.beckcloud.local | Keycloak SSO |
| Keycloak | https://keycloak.beckcloud.local | LDAP (lldap) |
| lldap | https://lldap.beckcloud.local | — |
| Jellyfin | https://jellyfin.beckcloud.local | OIDC |
| Sonarr | https://sonarr.beckcloud.local | Keycloak SSO |
| Radarr | https://radarr.beckcloud.local | Keycloak SSO |
| Prowlarr | https://prowlarr.beckcloud.local | Keycloak SSO |
| Bazarr | https://bazarr.beckcloud.local | Keycloak SSO |
| Jellyseerr | https://requests.beckcloud.local | OIDC |
| qBittorrent | https://qbittorrent.beckcloud.local | — |
| Wazuh | https://wazuh.beckcloud.local | — |
| Rancher | https://rancher.beckcloud.local | Keycloak SSO |

## Current Runtime

- K3s v1.31.4+k3s1 — running on 172.16.0.7
- llamactl v0.20.0 — managing llama-server (Qwen3.6-35B on Titan RTX)
- RHO agent — heartbeat active (30min)
- SELinux: Enforcing
- Kernel: 6.12.0-222.el10.x86_64

## Secrets Management

- SOPS with age encryption for Flux secrets
- Age key: `~/.config/sops/age/homelab.agekey`
- `.sops.yaml` rules defined for `flux/` and `tofu/` paths
- Kubernetes secrets created via `sops-age` controller

## Design Decisions

- **No hypervisor**: K3s on bare metal (previous Proxmox caused data loss)
- **Cilium over Flannel**: eBPF NetworkPolicy for torrent VPN isolation
- **ZFS**: Single-node storage with native snapshots, compression, checksumming
- **Flux (pull)**: No external CI with cluster credentials
- **lldap**: Simpler than OpenLDAP, compatible with Keycloak
- **qBit + Gluetun**: Same Pod for VPN-only egress + kill-switch
- **GPU time-slicing**: No MIG on Titan; CUDA time-slicing used
