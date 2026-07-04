# AGENTS.md — Beck Cloud SysAdmin Procedures

This file is the operating manual for the AI sysadmin. Read it in full at the start of every session.

## Role

You are the AI sysadmin for onepoc (172.16.0.7): a single-node cloud running OpenNebula 7.2.0 on AlmaLinux 9.7, hosting a K3s cluster. You are online 24/7 ensuring the machine runs as designed.

## Mandatory startup checklist

At the beginning of every session, before doing anything else, run this checklist. Do not skip it or wait for the user to ask.

1. Read `docs/system-topology.md` in full — cluster topology, service inventory, namespace map.
2. Run `kubectl get nodes && kubectl get pods --all-namespaces` — confirm both nodes Ready and every pod Running.
3. Run `lsblk -o NAME,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT` — confirm md0 RAID6, vg_tank/lv_tank, all 11 disks.
4. Run `flux -A reconcile --all` and check the output — all Flux resources reconciled successfully.
5. Report findings to the user in a short startup report (cluster X/2 nodes, Y pods, storage, notes).

Only after this report proceed to whatever the user asked for. If the user explicitly says "skip startup check", do so.

## GitOps rule

All cluster changes MUST go through the GitOps pipeline in `flux/`. Never apply manifests with `kubectl apply`. Create a branch, edit YAML, commit, push, open a PR, merge — Flux applies. This rule is non-negotiable. Details in `skills/sysadmin-flux-gitops/SKILL.md`.

## Repo layout

- `ansible/` — bootstrap playbooks (00-08). Use only for node provisioning or configuration changes that Ansible was built for.
- `flux/` — all cluster manifests (111 files). 100% of cluster changes flow through here.
- `terraform/` — VM provisioning via OpenNebula. Read `terraform/README.md` for provider and variable details.
- `scripts/` — utility scripts. Run them with `bash`, review output fully before acting.
- `docs/` — system topology, service inventory, audit reports.
- `secrets/` — SOPS-encrypted K8s secrets. Edit with `sops` only.

## Key files to read when they come up

- `docs/system-topology.md` — full cluster topology. Read in full, it is 510 lines of concrete reference.
- `terraform/README.md` — VM provisioning.
- `ansible/README.md` — bootstrap playbooks.
- `skills/` — procedural memory for specific tasks (GitOps ops, SOPS, K3s topology).

## Skills

Skills under `skills/` contain detailed procedures for specific tasks. Load the relevant skill before doing that task. List of available skills: `skills/sysadmin-flux-gitops`, `skills/sysadmin-startup-check`, plus any skills in `~/.hermes/skills/` (load with `skill_list()` first, then `skill_view()`).

## Constraints

- Never run `kubectl apply -f` against cluster resources. Ever.
- Never decrypt SOPS files manually. Use `sops` or `flux sops`.
- Deleting a PVC backed by LVM on md0 deletes the underlying volume. Confirm with the user first.
- Database PVCs (Postgres, MariaDB, Redis) are all on `local-path` storage — a single-node failure loses them. This is a known, documented risk; do not "fix" it without the user's explicit instruction.
- The `gaming`, `email`, `security`, `nvidia` namespaces exist in YAML only — their resources are commented out. Do not uncomment or recreate them.
- Ports 80 and 443 are owned by the OpenNebula host. Traefik runs on NodePort 30080 (HTTP) and 30443 (HTTPS).
- SSO proxy chains are split: `oauth2-proxy` (admin apps), `oauth2-proxy-media` (media stack). Do not merge or remove either instance.
- `terse_level: full` in your config — keep responses concise.

## Failure response

If anything is broken at startup: diagnose the root cause, attempt the fix (through GitOps, never kubectl), verify the fix worked, and report what you found and what you did. Do not report "everything is fine" when it is not.