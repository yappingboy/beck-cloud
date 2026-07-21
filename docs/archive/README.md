# Archived Files

Files moved here during repo restructures. Kept for reference; git history is the primary record.

## Completed Plans

| File | Original Path | Reason |
|------|---------------|--------|
| `raid6-storage-plan.md` | `plan/raid6-storage-plan.md` | RAID6 migration completed |
| `2026-05-29-jellyfin-jellyseerr-true-ssso.md` | `docs/plans/` | Superseded SSO approach |
| `2026-05-30-jellyfin-oauth2proxy-plugin.md` | `docs/plans/` | Superseded SSO approach |
| `DOCS-AUDIT-2026-07-20.md` | `docs/DOCS-AUDIT-2026-07-20.md` | Audit report — no longer needed alongside active docs |
| `repo-restructure-plan.md` | `docs/archive/` (created during restructure) | Restructure plan — executed and archived |

## Removed Code

| File | Original Path | Reason |
|------|---------------|--------|
| `01-zfs.yml` | `ansible/playbooks/` | ZFS abandoned, replaced by RAID6+LVM |
| `01-lvm-storage.yml` | `ansible/playbooks/` | Consolidated into `01-raid-storage.yml` |
| `exports.j2` | `ansible/playbooks/templates/` | NFS/ZFS artifact — no longer used |

## Removed Directories (contents archived above, dirs deleted)

| Directory | Reason |
|-----------|--------|
| `k8s/` | Legacy — contained dead Jellyfin C# plugin + orphaned quota file |
| `plan/` | Completed plans moved to `docs/archive/` |
| `docs/plans/` | Old plans moved to `docs/archive/` |
| `flux/infrastructure/llm/` | Rho disabled, npm package unavailable, LLM stack deferred |
| `flux/infrastructure/llm-stack.disabled/` | Superseded by `llm/` (now also removed) |
| `flux/infrastructure/rancher/` | Rancher removed from active kustomization |

## Restructured (2026-07-21)

| Moved From | Moved To | Reason |
|------------|----------|--------|
| `docs/research/` | `docs/reference/` + `docs/runbooks/` | "research" was a misnomer — these are reference docs and runbooks |
| `brand/` | `docs/brand/` | Brand assets belong in documentation |
| `ansible/docs/` | `docs/ansible/` | All documentation under `docs/` |
