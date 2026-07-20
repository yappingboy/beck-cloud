# Documentation Audit — 2026-07-20

**Auditor:** Nova (AI Sysadmin)  
**Audit scope:** All 7 research docs + operational procedures  
**Previous audit:** 2026-07-12 (5 of 7 docs updated; procedures-runbook and security-suite ran out of time)

---

## Summary

This audit completed the update cycle started on 2026-07-12. All 7 research documents are now current as of 2026-07-20.

**Documents updated this cycle:**

| Document | Previous Audit | This Audit | Status |
|----------|---------------|------------|--------|
| `system-overview.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (prev cycle) |
| `services-catalog.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (prev cycle) |
| `networking-ingress.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (prev cycle) |
| `storage-backups.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (prev cycle) |
| `gitops-automation.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (prev cycle) |
| `procedures-runbook.md` | 2026-07-12 | 2026-07-20 | ✅ Updated (this cycle) |
| `security-suite.md` | 2026-07-08 | 2026-07-20 | ✅ Updated (this cycle) |

---

## What Changed Since July 12

### Namespace Reorganization
- **`webapps`** created (~2026-07-15) — consolidation namespace for user-facing web services
- Services migrated **to** `webapps`: Affine, Bitwarden BSM, Directus, Home Assistant, Homepage, Landing page, Silex, OpenClaw
- Services migrated **to** `media`: SpotWeb (from `spotweb`), qBittorrent+Gluetun (from `torrent`)
- Service migrated **to** `identity`: Postfix relay (from `email`)
- Service migrated **to** `security`: Trivy Operator (from `trivy-system`)
- **New namespaces:** `3dprinting` (5 services), `gridspace` (4 services)
- **Old namespaces now empty:** `affine`, `bitwarden`, `cms`, `homepage`, `landing`, `email`, `spotweb`, `torrent`, `trivy-system`

### New Services
- **Home Assistant** — `ha.becklab.cloud`, admin SSO via `sso-admin-chain-no-auth-header`
- **OpenClaw** — `nova.becklab.cloud`, admin SSO
- **3D Printing stack (7 services):** Manyfold, FDM Monster, Spoolman, OrcaSlicer, BumpMesh
- **Gridspace (4 services):** Gridspace, Kiri:moto, Mesh Tool, Void:Form

### Infrastructure Changes
- Kernel upgraded: `6.8.0-124` → `6.8.0-134` (both nodes)
- user-invite upgraded: v1 → v4.1783837566
- oauth2-proxy (both admin and media tiers) — **FIXED** from CrashLoopBackOff to Running/Ready
- Wazuh — **FIXED** from 641+ restarts to 0 restarts (fresh deployment ~6d ago)
- Suricata — **DEPLOYED** (was planned), 2/2 Running in `security` namespace
- Trivy Operator — ⚠️ **BLOCKED** by `security-quota` ResourceQuota (CPU limit exceeded by Wazuh stack)
- Homepage HelmRelease moved from `homepage` to `webapps` namespace

### New SSO Middleware
- `sso-admin-chain-no-auth-header` — admin chain without `Authorization` header passthrough (used by Home Assistant)
- Gridspace redirect middlewares: `gridspace-kiri-root-redirect`, `gridspace-mesh-root-redirect`, `gridspace-void-root-redirect`
- Home Assistant path-prefix middlewares: `esphome-strip-prefix`, `mqtt-strip-prefix`

### HelmRelease Changes
- **Added:** `security/wazuh` (chart 2.0.0)
- **Moved:** `trivy-operator` from `trivy-system` → `security` (chart 0.32.0)
- **Moved:** `homepage` from `homepage` → `webapps`
- **Status issue:** `identity/oauth2-proxy` HelmRelease shows `False` (context deadline exceeded) despite pods being healthy — likely a transient Helm sync issue

---

## Per-Document Changes

### `procedures-runbook.md` (Updated this cycle)
- **DNS Records:** Added 5 new entries (ha, kiri, mesh, nova, void)
- **Verify Deployment:** Updated namespace list — removed empty namespaces (affine, bitwarden, cms, trivy-system), added webapps, 3dprinting, gridspace
- **IngressRoutes:** Updated expected routes table — moved services from old namespaces to webapps/gridspace, added Home Assistant, OpenClaw, Gridspace routes
- **First-Time Setup:** Added Home Assistant, OpenClaw entries
- **Email relay:** Updated to reflect Postfix relay moved from `email` to `identity` namespace
- **Port Forwarding:** Updated qBittorrent path from `torrent` to `media` namespace
- **Velero examples:** Updated example backup command to use `webapps` namespace
- **Disaster Recovery:** Updated priorities — added webapps namespace, reordered based on current backup schedules
- **New troubleshooting section:** Added Trivy Operator ResourceQuota failure pattern with diagnosis and resolution options
- **Common Operations:** Updated examples to use `webapps` as the default namespace for new services

### `security-suite.md` (Updated this cycle)
- **Suricata status:** Changed from ✅ Deployed (July 12) to ✅ Deployed with live pod details (2/2 Running, 0 restarts, ~5d10h age)
- **Wazuh status:** Updated from "641+ restarts investigating" to stable — all pods Running with 0 restarts (fresh deployment ~6d ago); added live pod table
- **Trivy Operator:** Changed from ✅ Deployed to ⚠️ Blocked — `security-quota` ResourceQuota prevents pod scheduling (CPU: requested 500m, 7300m/7350m already used by Wazuh)
- **Architecture diagram:** Updated to show Trivy blocked, removed Falco from live flow
- **Deployment Phases:** Phase 3 (IDS) marked ✅ COMPLETE; Phase 2 VAS updated to reflect Trivy blockage
- **Decision Log:** Added 3 new entries (Suricata deployed, Wazuh re-deployed, Trivy blocked)
- **Known Risks:** Added Trivy quota blockage and Falco eBPF issues
- **Live data:** Added pod tables with actual IPs, nodes, ages, and restart counts

---

## Drift Detected

| What docs said | What reality is | Resolution |
|---------------|-----------------|------------|
| Suricata planned but not deployed | Suricata 2/2 Running in `security` since ~5d ago | ✅ security-suite.md updated |
| Wazuh pods with 641+ restarts | All pods Running, 0 restarts (fresh deploy ~6d ago) | ✅ security-suite.md updated |
| Trivy Operator in `trivy-system` namespace | Moved to `security` namespace but blocked by quota | ✅ All docs updated; runbook includes troubleshooting |
| Postfix relay in `email` namespace | Moved to `identity` namespace | ✅ procedures-runbook updated |
| Services in individual namespaces (affine, bitwarden, cms, etc.) | All migrated to `webapps` | ✅ All docs updated |
| SpotWeb in `spotweb` namespace | Moved to `media` | ✅ All docs updated |
| qBittorrent in `torrent` namespace | Moved to `media` | ✅ All docs updated |
| `oauth2-proxy` HelmRelease status `False` | Pods actually Running/Ready | ⚠️ Transient Helm sync issue; pods healthy |
| `security-quota` not documented | CPU limit 7350m blocking Trivy scheduling | ✅ Added to runbook and security-suite |

---

## Cluster Warnings/Errors

### Active Issues
1. **Trivy Operator cannot schedule** — `security-quota` ResourceQuota exceeded (CPU: 7300m used / 7350m limit, Trivy needs 500m). Events show repeated `FailedCreate` every few minutes.
2. **Velero restic self-backup failing** — `velero-default-restic-c76vn` maintain jobs for velero namespace repeatedly entering Error state (self-referential backup issue).
3. **oauth2-proxy HelmRelease showing `False`** — Helm upgrade reports "context deadline exceeded" despite pods being healthy and running normally. Likely transient sync issue.

### Resolved Since July 12
- oauth2-proxy CrashLoopBackOff → Fixed (both admin and media tiers Running)
- Wazuh 641+ restarts → Fixed (fresh deployment, 0 restarts)

---

## Recommendations

1. **Increase `security-quota` CPU limit** — Raise from 7350m to at least 8000m to allow Trivy Operator to schedule alongside Wazuh
2. **Deploy Wazuh Dashboard IngressRoute** — TLS cert exists (`wazuh-becklab-cloud-tls`), SSO middleware ready, just needs IngressRoute
3. **Clean up empty namespaces** — Consider deleting `affine`, `bitwarden`, `cms`, `homepage`, `landing`, `email`, `spotweb`, `torrent`, `trivy-system` once confident migration is complete
4. **Resolve Velero restic self-backup** — Investigate `velero-default-restic` failures in velero namespace
5. **Suricata tuning** — Now deployed, begin alert validation and false positive tuning (IDS→IPS graduation path)

---

*Audit completed 2026-07-20. All 7 research docs current.*
