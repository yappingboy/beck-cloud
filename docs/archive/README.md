# Archived Files

Files moved here during the 2026-07-20 repo restructure. Kept for reference; git history is the primary record.

## Completed Plans

| File | Original Path | Reason |
|------|---------------|--------|
| `raid6-storage-plan.md` | `plan/raid6-storage-plan.md` | RAID6 migration completed |
| `2026-05-29-jellyfin-jellyseerr-true-ssso.md` | `docs/plans/` | Superseded SSO approach |
| `2026-05-30-jellyfin-oauth2proxy-plugin.md` | `docs/plans/` | Superseded SSO approach |
| `DOCS-AUDIT-2026-07-20.md` | `docs/DOCS-AUDIT-2026-07-20.md` | Audit report — no longer needed alongside active docs |

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
| `flux/infrastructure/llm/` | Rho disabled, npm package unavailable, LLM stack deferred |
| `flux/infrastructure/llm-stack.disabled/` | Superseded by `llm/` (now also removed) |
| `flux/infrastructure/rancher/` | Rancher removed from active kustomization |

## Stale Config

| File | Original Path | Reason |
|------|---------------|--------|
| `AGENTS.md` | Repo root | Hermes AI config — references non-existent files (`system-topology.md`, `terraform/`, `skills/`) |
