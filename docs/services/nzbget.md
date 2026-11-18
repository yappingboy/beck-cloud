# nzbget

**Purpose:** NZBGet — NZB and torrent download client.

**What it does:** NZBGet fetches NZB files (via NZB indexing services) and torrents, then stores them in the shared media volume for Jellyfin/Radarr/Sonarr to process. It runs as a container with moderate resources and persistent config.

**Resources:**
| Type | Details |
|------|---------|
| Image | `lscr.io/linuxserver/nzbget:latest`, 1 replica |
| CPU | 800m request / 4 limit |
| RAM | 512Mi request / 4Gi limit |
| PVCs | `nzbget-config` (5 GiB, local-path) for settings and download queue. `media-downloads` (5 TiB, LVM-backed) |

**Ports:**
- Container `6789` (TCP) — NZBGet HTTP API
- Service `6789` — ClusterIP
- IngressRoute: `nzbget.becklab.cloud` over TLS (Let's Encrypt), middleware `sso-admin-chain` (namespace `identity`)

**Environment variables:**
- `PUID` / `PGID` = `1000`
- `TZ` = `America/New_York`

**Notes:** NZBGet is one of two download engines in the stack (the other being SABnzbd). Both feed into the same storage pool.

## Queue-script dispatcher watchdog (`qs-watchdog.yaml`)

nzbget 26.3 intermittently stops dispatching extension scripts: `QueueScriptCount` freezes (550+ events seen), the par/post pipeline stalls, and finished items sit `QS_QUEUED` while downloads keep running. Observed three times in 72 h (2026-11-16 through 2026-11-18, ~22 h apart). A rarer variant wedges XML-RPC `status()` entirely while the web server thread still answers 200. Upstream (nzbgetcom) has no fix release; 26.3 is latest.

The watchdog CronJob (every 10 min, `python:3.12-alpine`, stdlib only) samples `status()` twice 90 s apart over XML-RPC:

- Both samples unresponsive → core deadlock → heal.
- `QueueScriptCount >= 50` and all three of `QueueScriptCount`/`ParJobCount`/`PostJobCount` identical → dispatcher stall → heal.
- Heals by deleting the nzbget pod via the K8s API (ServiceAccount `nzbget-qs-watchdog`, RBAC pods get/list/delete in `media` only). Pod delete is the proven recovery; queue state survives on the config PVC. Guards: refuses pods younger than 30 min, skips during multi-pod transitions and the 3 min after a scheduler boundary (`:00/:15/:30/:45`).

Ops: `kubectl -n media logs job/<latest nzbget-qs-watchdog-*>`. Force a verdict without deleting: one-off pod with `WATCHDOG_DRYRUN=true WATCHDOG_FORCE_STALL=true`. Test hook exists but only on the ConfigMap script — flip verdicts never delete in dry-run.

Manual clear (if you don't want to wait for the watchdog): `kubectl exec -n media deploy/nzbget -- s6-svc -t /run/service/svc-nzbget` clears a dispatcher stall; full core deadlock needs a pod delete.