# BeckCloud Documentation Index

**Last updated:** 2026-07-08  
**Repository:** `github.com/yappingboy/beck-cloud`

---

## Quick Start

| Document | Purpose | Audience |
|----------|---------|----------|
| [System Overview](research/system-overview.md) | **Start here.** Executive summary, full infrastructure map, all numbers in one place. | Everyone |
| [Services Catalog](research/services-catalog.md) | Detailed reference for every running service — ports, images, PVCs, access patterns. | Operators |
| [Networking & Ingress](research/networking-ingress.md) | Traefik routing, SSO middleware chains, TLS certificates, network architecture. | Network/security admins |
| [Storage & Backups](research/storage-backups.md) | PV/PVC inventory, Velero schedules, MinIO configuration, capacity planning. | Storage/backup admins |
| [GitOps & Automation](research/gitops-automation.md) | Flux CD pipeline, Ansible playbooks, SOPS encryption, custom app builds. | DevOps engineers |
| [Procedures & Runbook](research/procedures-runbook.md) | Step-by-step operational procedures, troubleshooting patterns, disaster recovery. | On-call / incident responders |

## Pre-existing Documentation

| Document | Purpose |
|----------|---------|
| [Post-Deploy Checklist](POST-DEPLOY-CHECKLIST.md) | Verification steps after initial infrastructure provisioning |
| [Keycloak Setup Guide](keycloak-setup.md) | Manual post-deploy configuration for LLDAP + Keycloak federation |
| [System Topology (original)](system-topology.md) | Previous topology documentation (see `research/` for updated version) |

## Research Directory (`docs/research/`)

Auto-generated from live cluster data by Nova (AI Sysadmin). Files in this directory represent the authoritative snapshot of cluster state as of 2026-07-08. Update them periodically or re-run the audit when making significant changes.

## Plans Directory (`docs/plans/`)

Future work and architectural planning:
- `plans/2026-05-29-jellyfin-jellyseerr-true-sso.md` — True SSO integration for Jellyfin/Jellyseerr
- `plans/2026-05-30-jellyfin-oauth2proxy-plugin.md` — oauth2-proxy plugin approach

---

*End of index.*
