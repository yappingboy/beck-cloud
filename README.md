# BeckCloud — Private Cloud Platform

Production-grade homelab on K3s + RAID6, managed via Flux CD GitOps.

## Architecture

| Layer | Component | Status |
|-------|-----------|--------|
| L1 | OS & Bootstrap (Ansible) | ✅ Playbooks ready |
| L2 | RAID6 + LVM Storage (Ansible) | ✅ Playbook ready |
| L3 | OpenNebula 7.2 (hypervisor) | ✅ Playbook ready |
| L3 | local-path provisioner (K3s built-in) | ✅ |
| L4 | K3s + Cilium (on OpenNebula VMs) | ✅ Playbook ready |
| L5 | GitOps (Flux CD) | ✅ Bootstrap + Sources + Controllers + Configs |
| L6 | Traefik + cert-manager + Crowdsec | ✅ HelmReleases + SSO middlewares + WAF |
| L7 | Identity (lldap + Keycloak + oauth2-proxy) | ✅ Full stack |
| L8 | Security (Wazuh + Suricata + Falco + Trivy) | ✅ Wazuh + Suricata deployed, Falco + Trivy defined |
| L9 | Media (Jellyfin/Sonarr/Radarr/etc) | ✅ Full stack |
| L10 | Backup (Velero + MinIO) | ✅ Full schedules |

## Repository Structure

```
├── .sops.yaml                    # SOPS encryption rules
├── ansible/                      # Bootstrap playbooks (bare-metal)
│   ├── inventory/                # Host inventories
│   ├── playbooks/                # Numbered playbooks (00-prereqs → 99-uninstall)
│   └── templates/                # Jinja2 templates
├── apps/                         # Application source code
│   ├── gridspace/                # Gridspace build files
│   ├── landing-page/             # Landing page source (Dockerfile, Python, JS)
│   └── user-invite/              # User provisioning app
├── brand/                        # Brand assets + landing page design
├── docs/                         # Documentation
│   ├── research/                 # Auto-generated cluster docs (by Nova)
│   └── archive/                  # Completed plans, removed code
├── flux/                         # Flux CD GitOps manifests
│   ├── flux-system/              # Flux bootstrap (gotk-components, gotk-sync)
│   ├── infrastructure/           # Infrastructure manifests (per-namespace)
│   │   ├── sources/              # HelmRepository definitions
│   │   ├── controllers/          # Cilium, NVIDIA device plugin
│   │   ├── configs/              # Storage classes, CoreDNS
│   │   ├── csi-snapshotter/      # VolumeSnapshotClasses
│   │   ├── cert-manager/         # cert-manager HelmRelease
│   │   ├── cert-manager-config/  # ClusterIssuers
│   │   ├── traefik/              # Traefik + middlewares + dashboard
│   │   ├── identity/             # lldap, Keycloak, oauth2-proxy, SSO
│   │   ├── security/             # Wazuh, Suricata, Trivy, Falco
│   │   ├── crowdsec/             # Crowdsec LAPI + bouncer
│   │   ├── monitoring/           # Prometheus, Grafana, Hubble
│   │   ├── media/                # Jellyfin stack, downloaders
│   │   ├── webapps/              # Affine, Bitwarden, Directus, HA, Homepage, etc.
│   │   ├── opennebula/           # Sunstone
│   │   ├── velero/               # Velero + MinIO
│   │   ├── rbac/                 # Cluster roles
│   │   ├── gaming/               # Crafty Controller
│   │   ├── 3dprinting/           # 3D printing stack
│   │   └── gridspace/            # Gridspace apps
│   └── apps/                     # User-facing apps (user-invite, toolbox)
└── secrets/                      # SOPS age key + SSH keys
```

## Deployment Sequence

```bash
# Install Ansible collections first
ansible-galaxy collection install -r ansible/requirements.yml

# 0. Minimal prereqs: packages, KVM, swap off, kernel modules, NTP
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/00-prereqs.yml

# 1. Build RAID6 array (md0) + LVM (vg_tank/lv_tank) → Tank datastore
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/01-raid-storage.yml

# 2. Install OpenNebula 7.2 AIO (frontend + KVM node, bridge networking, NAT)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/02-opennebula.yml

# 3. Apply host hardening (UFW, sysctls, SSH, optional NVIDIA)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/03-harden.yml

# 4. Provision K3s VM instances via OpenNebula
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/04-one-vms.yml
# → Update inventory k3s_nodes IPs then continue

# 5. Install K3s + Cilium on OpenNebula VMs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/05-k3s.yml

# 6. Bootstrap Flux
GITHUB_TOKEN=*** ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/06-flux.yml

# 7. Install CSI snapshot CRDs
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/07-snapshotter.yml

# 8. (Optional) AI sysadmin stack on host GPU
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/08-ai-sysadmin.yml

# 9. Backup media via NFS
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/09-backup-media-nfs.yml

# 10. Rotate SOPS keys (before re-running 06-flux)
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/10-sops-rotate.yml

# 11. Configure OpenNebula LDAP auth
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/11-opennebula-ldap.yml
```

## Flux Dependency Chain

```
flux-system (bootstrap)
  └── infrastructure-sources (HelmRepos)
        └── infrastructure-controllers (Cilium, NVIDIA)
              └── infrastructure-configs (StorageClasses, CoreDNS)
                    └── infrastructure-apps (Traefik, cert-manager, identity, security, media, webapps, ...)
                          └── apps (user-invite, toolbox)
```

Separate Kustomizations:
- `cert-manager-config` — ClusterIssuers (syncs after infrastructure)

## Services & URLs

| Service | URL | Auth |
|---------|-----|------|
| Affine Wiki | https://affine.becklab.cloud | Keycloak SSO |
| Bitwarden BSM | https://bw.becklab.cloud | None |
| Directus CMS | https://cms.becklab.cloud | Keycloak SSO |
| Grafana | https://grafana.becklab.cloud | Keycloak SSO |
| Hubble UI | https://hubble.becklab.cloud | Keycloak SSO |
| Home Assistant | https://ha.becklab.cloud | Keycloak SSO |
| OpenNebula | https://one.becklab.cloud | Keycloak SSO |
| OpenClaw | https://nova.becklab.cloud | Keycloak SSO |
| Silex | https://silex.becklab.cloud | Keycloak SSO |
| Traefik Dashboard | https://traefik.becklab.cloud | Keycloak SSO |
| Gridspace | https://grid.becklab.cloud | Keycloak SSO |
| Kiri:Moto | https://kiri.becklab.cloud | Keycloak SSO |
| Mesh Tool | https://mesh.becklab.cloud | Keycloak SSO |
| Void:Form | https://void.becklab.cloud | Keycloak SSO |
| Media Stack | Internal | Keycloak SSO |

## Secrets Management

- SOPS with age encryption for Flux secrets
- Age key: `secrets/homelab.agekey`
- `.sops.yaml` rules defined for `flux/` paths
- Kubernetes secrets created via `sops-age` controller
- **Key rotation:** see [ansible/docs/SOPS-ROTATION.md](ansible/docs/SOPS-ROTATION.md) — run playbook `10-sops-rotate.yml`

## Post-Deploy Configuration

- **[Keycloak + LLDAP setup](docs/keycloak-setup.md)** — create realm, LDAP federation, oauth2-proxy client, group scopes

## Design Decisions

- **OpenNebula 7.2:** AIO KVM hypervisor; K3s runs on ONE VMs for isolation
- **local-path:** K3s built-in provisioner — simple, no Ceph/NFS complexity
- **md0 RAID6 + LVM:** ~78TB usable from 14× 6TB HGST SAS drives
- **Cilium:** eBPF NetworkPolicy for torrent VPN isolation
- **Flux (pull):** No external CI with cluster credentials
- **lldap:** Simpler than OpenLDAP, Keycloak-compatible
- **qBit + Gluetun:** Same Pod for VPN-only egress + kill-switch
- **Velero + MinIO:** Full-cluster and namespace-specific backup schedules

## Documentation

- **[Docs Guide](docs/DOCS-GUIDE.md)** — How docs are organized and maintained
- **[System Overview](docs/research/system-overview.md)** — Full infrastructure map
- **[Archive](docs/archive/)** — Completed plans and removed code
