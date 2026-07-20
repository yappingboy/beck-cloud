# Repository Restructure Plan

**Date:** 2026-07-20  
**Author:** Nova  
**Status:** Draft — awaiting Stephen's approval

---

## Problems Found

### 1. Stale/Orphaned Directories

| Path | Issue |
|------|-------|
| `k8s/` | Legacy directory. `k8s/apps/media/jellyfin/plugin/` contains a C# Jellyfin OAuthProxy plugin that was superseded. `k8s/resource-policies/` has a single quota file that is not referenced by Flux. Nothing here is actively managed. |
| `plan/` | Contains `raid6-storage-plan.md` — a completed migration plan from 2026-07-05. The work is done. This is archival at best. |
| `flux/infrastructure/llm-stack.disabled/` | 8 YAML files for a deferred LLM stack (Flowise, LiteLLM, Ollama ×4, Open WebUI). The active `llm/` namespace already exists with the slim setup (llamactl-service only, rho disabled). Having both `.disabled` and active is confusing. |
| `flux/infrastructure/rancher/` | Rancher was removed from the active infrastructure kustomization but the directory still exists with namespace + HelmRelease files. README says "kept for reference" but it adds noise. |
| `flux/infrastructure/traefik-config/` | Symlinks back to `../traefik/` and `../identity/` files. This is a redirect shim that adds indirection — the actual files live in `traefik/` and `identity/` already. |

### 2. Duplicate Content

| Original | Duplicate | Issue |
|----------|-----------|-------|
| `apps/user-invite/` | `flux/apps/user-invite/` | Source code (Dockerfile, app.py, build-and-push.sh, README.md) lives in `apps/`. K8s manifests live in `flux/apps/`. But `flux/apps/user-invite/` also has copies of `deployment.yaml` and `kaniko-build.yaml` that **differ** from `apps/`. Which is source of truth? |
| `apps/gridspace/` | `flux/infrastructure/gridspace/` | Same pattern — Dockerfile + build files in `apps/`, K8s manifests in `flux/`. Less confusing since they don't overlap, but the split location is inconsistent with how other services are handled. |
| `ansible/playbooks/01-*.yml` | Three `01-` playbooks | `01-raid-storage.yml`, `01-lvm-storage.yml`, `01-zfs.yml` — all share the `01-` prefix. ZFS was abandoned, LVM was consolidated. The numbering implies they should run in sequence but they're alternative approaches. |

### 3. Inconsistent Structure

| Issue | Detail |
|-------|--------|
| `flux/infrastructure/webapps/landing-page/` contains source code | Dockerfile, Python source, JS files live directly in the Flux manifests directory. Source code should be in `apps/` or a dedicated `src/` directory, not mixed with K8s YAML. |
| `AGENTS.md` at repo root | This is an AI agent configuration file (startup checklist, GitOps rules, skills references). It references `docs/system-topology.md` (deleted), `terraform/` (doesn't exist), `skills/` (doesn't exist). It's completely stale and was written for a different AI system (Hermes). |
| `docs/plans/` | Contains two Jellyfin SSO implementation plans from May 2026. Both reference "Hermes" and "subagent-driven-development". These are old experiment artifacts, not active plans. |
| `ansible/playbooks/templates/` | Contains `exports.j2` (NFS exports for ZFS → abandoned) and `sunbeam-manifest.yaml.j2` (OpenNebula VM manifest → used by 04-one-vms.yml). Mixed active/dead templates. |
| `brand/` directory | Brand guide, colors, logo docs, and a full website. The website (`brand/website/`) is the BeckCloud landing page, but the actual deployed version lives in `flux/infrastructure/webapps/landing-page/` as a Silex-built site. `brand/website/` might be the source or a duplicate. |

### 4. Documentation Issues

| Issue | Detail |
|-------|--------|
| `README.md` is outdated | References ZFS (replaced by RAID6), Ceph (removed), Rancher management role, Rook, old deployment sequence, services that moved namespaces. Needs significant update. |
| `docs/DOCS-AUDIT-2026-07-20.md` | Audit report. Useful as a changelog artifact but shouldn't live alongside operational docs. |
| `docs/index.md` | Documentation index — good, but doesn't account for `ansible/docs/` or `brand/` docs. |

### 5. Miscellaneous

| Issue | Detail |
|-------|--------|
| `flux/infrastructure/llm/` is minimal | Only namespace + llamactl-service, with rho commented out. The namespace exists but rho is disabled. Question: keep or remove? |
| `.gitignore` could be better | Only ignores SOPS artifacts and `secrets/`. Should also ignore `.hermes/`, `__pycache__/`, `.DS_Store`, etc. |

---

## Proposed Target Structure

```
beck-cloud/
├── README.md                          # Updated repo overview
├── .gitignore                         # Expanded
├── .sops.yaml                         # SOPS config (keep as-is)
│
├── ansible/                           # Bare-metal provisioning (keep)
│   ├── ansible.cfg
│   ├── requirements.yml
│   ├── inventory/
│   │   ├── hosts.yml
│   │   └── group_vars/all.yml
│   ├── playbooks/
│   │   ├── 00-prereqs.yml
│   │   ├── 01-raid-storage.yml        # Active — RAID6
│   │   ├── 02-opennebula.yml
│   │   ├── 03-harden.yml
│   │   ├── 04-one-vms.yml
│   │   ├── 05-k3s.yml
│   │   ├── 06-flux.yml
│   │   ├── 07-snapshotter.yml
│   │   ├── 08-ai-sysadmin.yml
│   │   ├── 09-backup-media-nfs.yml
│   │   ├── 10-sops-rotate.yml
│   │   ├── 11-opennebula-ldap.yml
│   │   └── 99-uninstall.yml
│   ├── templates/
│   │   └── sops.yaml.j2
│   └── playbooks/templates/
│       └── sunbeam-manifest.yaml.j2   # Keep — used by 04-one-vms
│
├── apps/                              # Application source code (keep)
│   ├── user-invite/
│   │   ├── Dockerfile
│   │   ├── app.py
│   │   ├── README.md
│   │   └── build-and-push.sh
│   └── gridspace/
│       ├── Dockerfile
│       ├── tina2s-configmap.yaml
│       └── kaniko-build.yaml
│
├── brand/                             # Brand assets (keep)
│   ├── BRAND-GUIDE.md
│   ├── COLORS.md
│   ├── LOGO.md
│   └── website/                       # Landing page source
│
├── docs/                              # Documentation (keep, reorganize)
│   ├── DOCS-GUIDE.md                  # How docs are organized
│   ├── index.md                       # Documentation index
│   ├── keycloak-setup.md              # Setup guide
│   ├── research/                      # Auto-generated cluster docs
│   │   ├── system-overview.md
│   │   ├── services-catalog.md
│   │   ├── networking-ingress.md
│   │   ├── storage-backups.md
│   │   ├── gitops-automation.md
│   │   ├── procedures-runbook.md
│   │   └── security-suite.md
│   └── archive/                       # NEW — completed plans and old artifacts
│       ├── DOCS-AUDIT-2026-07-20.md   # Moved from docs/
│       ├── raid6-storage-plan.md      # Moved from plan/
│       ├── 2026-05-29-jellyfin-jellyseerr-true-ssso.md   # Moved from docs/plans/
│       └── 2026-05-30-jellyfin-oauth2proxy-plugin.md     # Moved from docs/plans/
│
├── flux/                              # GitOps manifests (keep, clean up)
│   ├── kustomization.yaml
│   ├── flux-system/                   # Flux bootstrap (keep)
│   ├── infrastructure/
│   │   ├── kustomization.yaml
│   │   ├── infrastructure.yaml        # Flux Kustomizations (dependency chain)
│   │   ├── flux-system.yaml           # Flux self-bootstrap
│   │   ├── sources/
│   │   ├── controllers/
│   │   ├── configs/
│   │   ├── csi-snapshotter/
│   │   ├── cert-manager/
│   │   ├── cert-manager-config/
│   │   ├── traefik/
│   │   ├── identity/
│   │   ├── security/
│   │   ├── monitoring/
│   │   ├── media/
│   │   ├── webapps/                   # Merged: landing-page source moves to apps/
│   │   ├── opennebula/
│   │   ├── velero/
│   │   ├── rbac/
│   │   ├── crowdsec/
│   │   ├── gaming/
│   │   ├── 3dprinting/
│   │   ├── gridspace/
│   │   ├── llm/                       # Keep minimal (llamactl only)
│   │   └── # REMOVED:
│   │       ├── llm-stack.disabled/    # Superseded by llm/
│   │       ├── rancher/               # Removed from active use
│   │       └── traefik-config/        # Was symlink shim — inline or remove
│   └── apps/
│       ├── kustomization.yaml
│       ├── apps.yaml
│       ├── toolbox/
│       └── user-invite/               # K8s manifests only (source in apps/)
│
└── secrets/                           # Encrypted keys (keep)
    ├── homelab.agekey
    └── id_ed25519
```

---

## Actions Required

### Phase 1: Archive (low risk)

| # | Action | Risk |
|---|--------|------|
| 1 | Create `docs/archive/` directory | None |
| 2 | Move `docs/DOCS-AUDIT-2026-07-20.md` → `docs/archive/` | None |
| 3 | Move `plan/raid6-storage-plan.md` → `docs/archive/` | None |
| 4 | Move `docs/plans/*.md` → `docs/archive/` | None |
| 5 | Remove `plan/` directory (now empty) | None |
| 6 | Remove `docs/plans/` directory (now empty) | None |

### Phase 2: Remove Dead Code (low risk)

| # | Action | Risk |
|---|--------|------|
| 7 | Remove `k8s/` directory entirely | Low — nothing references it |
| 8 | Remove `AGENTS.md` from repo root | Low — stale Hermes config |
| 9 | Remove `flux/infrastructure/llm-stack.disabled/` | Low — superseded by `llm/` |
| 10 | Remove `flux/infrastructure/rancher/` | Low — not in active kustomization |
| 11 | Remove `ansible/playbooks/01-zfs.yml` | Low — ZFS abandoned |
| 12 | Remove `ansible/playbooks/01-lvm-storage.yml` | Low — LVM consolidated into 01-raid-storage |
| 13 | Remove `ansible/playbooks/templates/exports.j2` | Low — NFS/ZFS artifact |

### Phase 3: Resolve Duplicates (medium risk)

| # | Action | Risk |
|---|--------|------|
| 14 | Determine source of truth for `user-invite` — `apps/` or `flux/apps/` | Medium — need to pick winner and sync |
| 15 | Move `flux/infrastructure/webapps/landing-page/` source code (Dockerfile, Python, JS) to `apps/landing-page/` | Medium — changes file paths |
| 16 | Update `flux/infrastructure/webapps/landing-page/` to reference `apps/landing-page/` for Kaniko build | Medium — Kaniko source path changes |

### Phase 4: Fix Indirection (medium risk)

| # | Action | Risk |
|---|--------|------|
| 17 | Resolve `flux/infrastructure/traefik-config/` — either inline the files or remove the shim | Medium — affects Flux path |

### Phase 5: Update Documentation (low risk)

| # | Action | Risk |
|---|--------|------|
| 18 | Update `README.md` — reflect current state (RAID6, namespaces, services, Ansible playbook order) | Low |
| 19 | Update `docs/DOCS-GUIDE.md` — reflect new structure | Low |
| 20 | Update `docs/index.md` — add archive reference | Low |
| 21 | Update `.gitignore` — add common patterns | None |

---

## What Stays the Same

- `flux/` hierarchy for namespace manifests — this is well-structured and working
- `ansible/` playbook numbering (00-11, 99) — makes sense for execution order
- `docs/research/` auto-generated docs — good system, just needs `DOCS-GUIDE.md` to reference `docs/archive/`
- `secrets/` directory structure
- `brand/` directory structure

---

## Questions for Stephen

1. **`llm/` namespace** — rho is disabled and the npm package doesn't exist. Keep the minimal namespace for future, or remove entirely?
2. **`brand/website/`** — Is this the source for the landing page, or a standalone BeckCloud brand site? The deployed landing page uses Silex templates in `flux/infrastructure/webapps/landing-page/silex.yaml`. Are they related?
3. **`user-invite` source of truth** — `apps/user-invite/` or `flux/apps/user-invite/`? The files differ. Which version is running?
4. **`traefik-config/` shim** — This kustomization references `../traefik/middlewares.yaml` etc. It exists so Flux can sync traefik middleware separately from traefik itself. Should I inline it or keep the indirection?
5. **Archive or delete?** — For the removed items (ZFS playbook, lvm playbook, llm-stack.disabled, rancher), do you want them in `docs/archive/` or just deleted (git history preserves them)?
