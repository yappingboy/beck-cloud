# Documentation Guide

This file explains how the BeckCloud documentation is organized, formatted, and maintained. Read this before making changes to any docs.

---

## Repository Structure

```
beck-cloud/
├── README.md                    # Repo entry point (brief overview + links)
├── ansible/                     # Ansible playbooks for bare-metal provisioning
│   ├── docs/                    # Ansible-specific documentation
│   │   └── SOPS-ROTATION.md     # How to rotate SOPS age keys
│   ├── inventory/               # Host inventories
│   ├── playbooks/               # Numbered playbooks (00-prereqs → 99-uninstall)
│   └── templates/               # Jinja2 templates for VM manifests, exports, etc.
├── docs/                        # All operational documentation ← YOU ARE HERE
│   ├── DOCS-GUIDE.md            # This file — how docs are organized and formatted
│   ├── keycloak-setup.md        # Step-by-step Keycloak + LLDAP setup guide
│   └── research/                # Auto-generated from live cluster data by Nova (AI sysadmin)
│       ├── system-overview.md      # Executive summary, infrastructure stack, namespace map
│       ├── services-catalog.md     # Per-service details (ports, images, PVCs, status)
│       ├── networking-ingress.md   # Traefik routing, SSO middleware chains, TLS
│       ├── storage-backups.md      # PVs, PVCs, Velero schedules, MinIO
│       ├── gitops-automation.md    # Flux CD pipeline, Ansible playbooks, SOPS
│       ├── procedures-runbook.md   # Operational procedures, troubleshooting, post-deploy checklist
│       └── security-suite.md       # Security stack plan (Wazuh, Trivy, Falco, Suricata)
├── flux/                        # Flux CD GitOps manifests
│   ├── kustomization.yaml               # Root Flux config
│   ├── infrastructure/                  # Infrastructure Kustomization (syncs every 1m)
│   │   ├── kustomization.yaml           # Root infra kustomization
│   │   ├── <namespace>/                 # Per-namespace manifests
│   │   │   ├── kustomization.yaml       # Namespace resources list
│   │   │   ├── namespace.yaml           # Namespace definition
│   │   │   ├── *.yaml                   # Deployments, Services, ConfigMaps, etc.
│   │   │   └── secret-*.yaml            # SOPS-encrypted secrets
│   │   ├── traefik-config/              # Traefik middleware, HTTPS redirect
│   │   ├── cert-manager-config/         # ClusterIssuer for Let's Encrypt
│   │   ├── configs/                     # CoreDNS custom config, etc.
│   │   └── csi-snapshotter/             # Volume snapshot CRDs
│   └── apps/                          # User-facing apps Kustomization (syncs every 5m)
│       ├── kustomization.yaml           # Apps root
│       ├── homepage/                    # Homepage dashboard HelmRelease
│       ├── toolbox/                     # Build containers (Kaniko)
│       └── user-invite/                 # Custom Python app + build config
├── apps/                          # Application source code
│   └── user-invite/                 # Python user provisioning app + Dockerfile
└── .sops.yaml                     # SOPS encryption config (age keys)
```

---

## Documentation Categories

### 1. Research Docs (`docs/research/`)

**Author:** Nova (AI sysadmin), auto-generated from live cluster data.  
**Audience:** Anyone who needs to understand the current state of the lab.  
**Update cadence:** Reviewed and updated periodically by Nova, or when significant changes occur.

These are **single-source-of-truth** documents. Each covers a specific domain:

| Document | Covers | Key Sections |
|----------|--------|-------------|
| `system-overview.md` | Infrastructure from top to bottom | Hypervisor → K3s → namespaces, service exposure map, SSO architecture, HelmReleases, Ansible playbooks, known issues |
| `services-catalog.md` | Every running service in detail | Per-namespace tables with images, ports, PVCs, status, access patterns |
| `networking-ingress.md` | Traefik, SSO chains, TLS, DNS | Architecture diagrams, middleware flow, IngressRoute inventory, Cilium policies |
| `storage-backups.md` | PVs, PVCs, Velero, MinIO | Storage classes, volume inventory, backup schedules, capacity summary |
| `gitops-automation.md` | Flux pipeline, Ansible, SOPS | Kustomization hierarchy, HelmReleases, playbook order, secret files |
| `procedures-runbook.md` | Operations, troubleshooting, checklists | Common operations (add service, add IngressRoute, restart), debug patterns, post-deploy checklist |
| `security-suite.md` | Security stack plan and status | Wazuh, Trivy Operator, planned Falco/Suricata, deployment phases |

### 2. Setup Guides (`docs/`)

**Author:** Nova + Stephen  
**Audience:** Anyone setting up or re-provisioning services.  
**Purpose:** Step-by-step procedural guides for manual configuration.

| Document | Purpose |
|----------|---------|
| `keycloak-setup.md` | Complete walkthrough of LLDAP → Keycloak federation, oauth2-proxy client setup, group scopes |

### 3. Ansible Docs (`ansible/docs/`)

**Author:** Nova + Stephen  
**Purpose:** Documentation specific to the Ansible provisioning layer.

| Document | Purpose |
|----------|---------|
| `SOPS-ROTATION.md` | How to rotate SOPS age keys (critical security procedure) |

---

## Formatting Conventions

### Headers

Use ATX-style headers with clear hierarchy:

```markdown
# Title (H1 — one per document, matches filename concept)

## Major Section (H2)
### Subsection (H3)
#### Detail Level (H4 — use sparingly)
```

- H1 is the document title only.
- H2 for major sections (Namespace Inventory, Port Matrix, etc.).
- H3 for subsections within a section.
- Avoid going deeper than H4.

### Metadata Block

Every research doc starts with:

```markdown
# Document Title

**Last audited:** YYYY-MM-DD  
**Scope:** Brief description of what this document covers
```

Setup guides use:

```markdown
# Guide Title

**Last updated:** YYYY-MM-DD

Brief description paragraph.
```

### Tables

Use tables for structured data (namespaces, services, PVCs, etc.):

- Include a brief description before the table explaining what it shows.
- Column headers should be concise but clear.
- Sort alphabetically or by logical grouping (e.g., system namespaces first, then user namespaces).

```markdown
| Namespace | Purpose | Key Services | Status |
|-----------|---------|--------------|--------|
| `bitwarden` | Password vaulting | Vaultwarden BSM | ✅ Active |
```

### Status Indicators

Use emoji for quick status scanning:

| Symbol | Meaning |
|--------|---------|
| ✅ | Healthy / active / deployed |
| ⚠️ | Degraded / known issues / partial functionality |
| ❌ | Down / broken / CrashLoopBackOff |
| 🔴 | High severity issue |
| 🟡 | Medium severity issue |
| 🟢 | Low severity / informational |
| 🔲 | Planned but not deployed |

### Code Blocks

- Always specify language for syntax highlighting: ````bash`, `yaml`, `json`.
- Include comments explaining non-obvious commands.
- Show the full command, not abbreviated versions.

```markdown
```bash
# Check backup status across all schedules
kubectl get backups -n velero --sort-by=.metadata.creationTimestamp
```
```

### Diagrams

Use ASCII art for architecture diagrams (no Mermaid/PlantUML — keep it universally readable):

```
Internet → becklab.cloud DNS → Bare Metal IP
                                      │
                          ┌───────────┴───────────┐
                          │   Traefik NodePort    │
                          └───────────┬───────────┘
```

### Links

- Cross-reference other docs with relative paths: `[Storage & Backups](storage-backups.md)`
- External links should include the full URL in parentheses for reference.

---

## Update Procedures

### When to Update

Update the research docs when any of the following happen:

1. **New service deployed** — Add to namespace inventory, services catalog, exposure map.
2. **Service removed/disabled** — Document removal, update inventories, note in known issues if relevant.
3. **Version upgrade** — Update HelmRelease versions, image tags, chart versions.
4. **Configuration change** — SSO chains modified, middleware updated, DNS changed.
5. **Infrastructure change** — New namespace, storage class, PV/PVC added or resized.
6. **Incident resolved** — Update known issues section with resolution notes.

### How to Update Research Docs

These are auto-generated by Nova from `kubectl` output and cluster inspection. To trigger an update:

1. Tell Nova to audit the docs ("update the research docs" or "refresh system-overview").
2. Nova will run kubectl commands, compare against existing docs, and write updates.
3. Review the changes — Nova may not catch nuanced operational context that only a human knows.

### How to Update Setup Guides

1. Edit directly in `docs/` for procedural guides like `keycloak-setup.md`.
2. Test the procedure before committing (or have Nova verify it against live state).
3. Update the "Last updated" date at the top.

### Documentation Commit Convention

```
docs: update system-overview with new affine namespace and trivy-system
docs: add post-deploy checklist to procedures-runbook
docs: fix Traefik version (v3.4.3, not v36.3.0)
docs: remove outdated system-topology.md, fold into research docs
```

---

## What NOT to Do

- **Don't** create new top-level `.md` files in `beck-cloud/` root for documentation — put everything under `docs/`.
- **Don't** keep service credentials or plaintext secrets in any doc file — reference encrypted secrets instead.
- **Don't** mix Helm chart versions with container image versions (e.g., Traefik v3.4.3 is the image, 36.3.0 is the Helm chart).
- **Don't** assume IngressRoutes exist just because TLS certificates do — verify with `kubectl get ingressroute -A`.
- **Don't** leave "TODO" or "FIXME" comments in docs without a corresponding GitHub issue or tracking item.

---

## Quick Reference: Key Commands for Auditing

```bash
# Namespace inventory
kubectl get namespaces

# All pods with status
kubectl get pods -A

# IngressRoutes (external exposure)
kubectl get ingressroute -A

# HelmReleases
kubectl get helmrelease -A

# Kustomizations
kubectl get kustomization -n flux-system

# TLS certificates
kubectl get certificates -A

# Persistent Volumes + Claims
kubectl get pv
kubectl get pvc -A

# Backup schedules
kubectl get schedules -n velero

# Flux sync status
kubectl get gitrepository,sourcecontrol -n flux-system
```

---

*This guide is itself a document that should be updated as the repo evolves.*
