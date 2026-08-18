# MEMORY.md — Nova's Long-Term Memory

## BeckCloud Infrastructure (Updated 2026-07-08)

**CRITICAL: Read this before any cluster work.** This is the core knowledge I need every session.

### Cluster at a Glance
- **Platform:** K3s v1.32.0+k3s1 on Ubuntu 24.04 VMs (OpenNebula CE 7.2 AIO, AlmaLinux 9 host "becklab")
- **Nodes:** k3s-server (172.16.0.20 / 192.168.100.10) + k3s-worker-1 (192.168.100.11, ProxyJump via server)
- **CNI:** Cilium v1.17. **Landing page fix (2026-07-31):** `becklab.cloud` returned 404 because of two mismatches: (a) Certificate named `bechlab` created secret `bechlab-tls` but IngressRoute referenced `landing-page-tls`, (b) IngressRoute pointed to service port `8080` but the Service only exposes port `80`. Fixed by renaming cert to `landing-page` (secret: `landing-page-tls`) and correcting port to `80`.0 with Hubble
- **Ingress:** Traefik v3.4.3 on NodePort :80/:443 → `*.becklab.cloud` domains
- **GitOps:** Flux CD → GitHub `yappingboy/beck-cloud` (main branch, 1m sync)

### Namespaces & Key Services
| NS | Purpose | Key Services |
|----|---------|-------------|
| identity | SSO/Auth | Keycloak 26.0 + LLDAP + oauth2-proxy ×2 + Redis |
| media | Media stack | Jellyfin, Sonarr, Radarr, Prowlarr, Bazarr, SABnzbd, nzbget, Tdarr, Homebox, Jellyseerr |
| torrent | Downloads | qBittorrent + Gluetun VPN |
| monitoring | Observability | Prometheus + Grafana (kube-prometheus-stack v65.5.0) |
| bitwarden | Passwords | Vaultwarden BSM (`bw.becklab.cloud`) |
| cms | Headless CMS | Directus 11 (`cms.becklab.cloud`) |
| velero | Backups | Velero v1.15.0 + MinIO (200Gi) |
| gaming | Game servers | Crafty Controller (Minecraft, NodePort :31337→:25565) |
| affine | Collaborative wiki | Affine server + PostgreSQL + Redis [NEW] |
| trivy-system | Vulnerability scanning | Trivy Operator [NEW] |
| crowdsec | WAF + IP reputation | Crowdsec LAPI + Agents + Traefik Bouncer plugin v1.4.5 (stream mode, global) |
| toolbox | Build utilities | Kaniko build pods [ACTIVE] |

### SSO Architecture
- **Admin chain:** `sso-admin-chain` = oauth2-redirect → keycloak-forwardauth (oauth2-proxy admin tier, requires `/admins` group in LLDAP)
- **Media chain:** `sso-media-chain` = same pattern with separate oauth2-proxy instance for `/media` group
- **Crowdsec bouncer:** `crowdsec-bouncer` middleware in `traefik` namespace (not `crowdsec`), applied globally to web/websecure entrypoints (stream mode, blocks banned IPs before SSO)
- Keycloak federates to LLDAP via LDAP on port 389

### Storage
- Media: LVM PVs (140+ TiB total across anime/movies/shows/downloads/torrent) — NOT backed up by Velero
- Service configs: local-path provisioner PVCs (~280 GiB total)
- Backups: MinIO 200Gi for Velero object storage

### Backup Strategy (Velero)
- velero-0: identity ns, every 6h, 30d retention
- velero-1: security ns, daily 02:00, 90d retention
- velero-2: media+torrent ns, daily 01:00, 14d retention
- velero-3: cattle-system ns, daily 04:00, 30d retention
- velero-4: ALL namespaces, weekly Sunday 02:00, 90d retention

### Active IngressRoutes (exposed to internet)
- `affine.becklab.cloud` → Affine wiki (admin SSO) [NEW 2026-07-12]
- `bw.becklab.cloud` → bitwarden BSM (no SSO)
- `cms.becklab.cloud` → Directus (admin SSO)
- `grafana.becklab.cloud` → Grafana (admin SSO)
- `lldap.becklab.cloud` → LLDAP admin dashboard (admin SSO + Crowdsec) [2026-08-02]
- `oauth2.becklab.cloud` → oauth2-proxy admin redirect (TLS only, no SSO) [2026-08-02]
- `hubble.becklab.cloud` → Hubble UI (admin SSO)
- `one.becklab.cloud` → OpenNebula Sunstone (admin SSO)
- `silex.becklab.cloud` → Silex design tool (admin SSO)
- `traefik.becklab.cloud` → Traefik dashboard (admin SSO)

### GitOps Structure
- 5 Kustomizations: flux-system, infrastructure (1m), traefik-config, cert-manager-config, apps
- 9 HelmReleases: cert-manager, cilium, traefik, velero, kube-prometheus-stack, homepage, oauth2-proxy ×2, crowdsec
- Secrets encrypted with SOPS + age keys

### Ansible Playbooks (in order)
00-prereqs → 01-zfs/lvm/raid → 02-opennebula → 03-harden → 04-one-vms → 05-k3s → 06-flux → 07-snapshotter → 08-ai-sysadmin → 09-backup-media-nfs → 10-sops-rotate

### Key SSH Details
- Hypervisor: `root@becklab` (AlmaLinux 9)
- K3s master: `ubuntu@172.16.0.20`, key at `/root/.ssh/K3s`
- K3s worker: reachable only via ProxyJump through master
- Sandbox SSH key: Stephen's ED25519 key stored at `~/.ssh/id_ed25519` (public: `stephen@Vex`) — added 2026-07-15

### Documentation Location
Comprehensive docs in `beck-cloud/docs/`:
- `DOCS-GUIDE.md` — repo structure, formatting conventions, update procedures (NEW 2026-07-12)
- `keycloak-setup.md` — IdP federation setup guide
- `research/system-overview.md` — executive summary + namespace map
- `research/services-catalog.md` — per-service details
- `research/networking-ingress.md` — Traefik, SSO chains, TLS
- `research/storage-backups.md` — PVs, Velero, MinIO
- `research/gitops-automation.md` — Flux pipeline, Ansible, SOPS
- `research/procedures-runbook.md` — ops procedures + post-deploy checklist (merged from old POST-DEPLOY-CHECKLIST.md)
- `research/security-suite.md` — Wazuh/Trivy deployed, Falco/Suricata planned
- Full docs pushed to GitHub at `docs/research/`
- Deleted: `system-topology.md` (outdated/wrong), `POST-DEPLOY-CHECKLIST.md` (merged into runbook)

### Lessons Learned
- Realm: homelab, Client: nova-monitoring, User: yappingboy
- Token URL: https://keycloak.becklab.cloud/realms/homelab/protocol/openid-connect/token
- See TOOLS.md for credentials

8. Keycloak pods get killed by CPU quota — identity namespace limited to 6 cores CPU. Keycloak needs ~1 core. Reduce its limits if other pods exceed quota.
9. `secret-keycloak` must exist in identity ns for audit-sync job (it's actually populated from audit-sync-secrets data).
10. oauth2-proxy HelmRelease upgrade timeout was 60s — too short. Increased to 5m.
11. **Never manually patch secrets with `kubectl apply/patch`.** Always fix the SOPS-encrypted manifest in the repo, commit, push, and let Flux apply. Manual patches break Flux drift detection.
12. **Always verify new tokens are valid** before putting them in secrets — test with `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <token>" https://api.github.com` first.
13. **Every service directory under `flux/infrastructure/` needs a `kustomization.yaml`**, even if it only lists one YAML file in `resources:`. Without it, kustomize treats the directory as a nested kustomization and fails with `"error decrypting env sources: no kustomization file found"`. This is required by kustomize's directory traversal — when a parent kustomization references a directory name as a resource, kustomize must find `kustomization.yaml` inside it.
14. **When restructuring namespaces per FILING-SYSTEM.md**, after moving YAML files into service subdirectories, generate `kustomization.yaml` for each service directory listing its YAML files in `resources:`. This is a mandatory step, not optional.
15. `flux-system` Kustomization has interval 10m — stale status messages in `kubectl get kustomizations` may persist for up to 10m. Use `kubectl annotate kustomization <name> --overwrite fluxcd.io/force-sync=$(date +%s)` to force immediate re-check.
16. **Provisioning Standardization Complete (2026-07-31):** All services now use IngressRoute (traefik.io/v1alpha1). 24 Certificate resources added for managed TLS. Namespace labels standardized across 14 namespaces. Homepage patches updated to IngressRoute format. PVCs centralized in gaming and identity. Full commit: `7b17550` → pushed to main.
17. **Kaniko Build Jobs Fix (2026-08-07):** All 13 micro-service build jobs fixed and pushed to GHCR. Issues:
    - Jobs created in `toolbox` namespace but kustomization applied to `micro` ns
    - Missing `ghcr-config` secret in `micro` ns → copied from `toolbox`
    - ResourceQuota too small → increased from 4 CPU/2Gi to 16 CPU/16Gi
    - Init containers needed resource limits → added 500m CPU/512Mi limits
    - Kaniko needed more memory → increased from 2Gi to 3Gi per job
    - Jobs getting stuck at "Found cached layer" → deleted and recreated
    - yaml-json-tool OOMKilled at 1Gi and 2Gi → resolved at 3Gi
    - All 13 jobs Complete, images pushed to GHCR:
      hash, converter, url-shortener, qr-generator, yaml-json-tool, webhook-relay, cron-jobs, dns-monitor, auth-micro, image-editor-api, image-editor-frontend, beckflow, beckflow-frontend
17. **Keycloak LDAP sync (2026-08-01):** LDAP component ID `VnS4h2_gToCK7G_Yus4j2w` uses `bindCredential: y4pp1ngb0y`, `syncRegistrations: true`, `enabled: true`. Last sync was June 6, 2026 (stale). Passwords stored in LLDAP's SQLite `users.db`, not Keycloak's PostgreSQL credential table. `user_federation_provider` table empty — Keycloak uses `component` system for LDAP storage. `user_attribute` table has `LDAP_ENTRY_DN` and `LDAP_ID` for synced users. audit-sync CronJob fixed: added `apk add --no-cache jq` to command; fixed client ID from `kc-admin-cli` to `admin-cli`. Master realm admin password reset to `y4pp1ngb0y` via Argon2id hash update.

### Traefik Dashboard Fix (2026-07-29)

traefik.becklab.cloud was returning 500 due to cascading failure:
- Keycloak killed by CPU quota → oauth2-proxy Helm upgrade failed → SSO middleware broken
- Fixed by reducing Keycloak CPU limits (2→1), creating missing `secret-keycloak`, increasing oauth2-proxy timeout
- Both traefik.becklab.cloud and nova.becklab.cloud now return 401 (SSO login) instead of 500

### Keycloak Monitoring Client (for authenticated API testing)
1. Don't spawn subagents for data collection — they burn tokens before writing files. Collect + write in same session.
2. kubectl connectivity from the sandbox can drop mid-session. If it does, collect what you can and proceed with cached data.
3. Media services (Jellyfin, Sonarr, etc.) currently have NO IngressRoutes despite having TLS certs — they're internal-only right now. Don't assume they're externally accessible.
4. When MEMORY.md already has a section about something, read it first before treating the task as fresh work.
5. Run Ansible playbooks to apply changes, don't do manual SSH edits and write the playbook afterward.
6. NEVER store passwords in plaintext YAML — even temporarily, even in private repos. Use SOPS (with --ignore-mac if needed), sealed secrets, or external secret managers. If Git history gets polluted, force-push to clean it.
7. Swiparr docs updated in services-catalog.md — deployed to `media` namespace (not standalone), SSO via `sso-media-chain` (Keycloak `/media` group). Port 4321, SQLite, Jellyfin provider.
8. Wazuh dashboard probes: chart default `httpGet.path: /api/status` returns 401 (auth required). Override to `httpGet.path: /` which returns 302 (success). Setting entire probe to null doesn't work due to Helm deep merge behavior — must override the sub-fields.

## LLDAP Restore Issues (2026-07-27)

**Problem:** Lost LLDAP database over the weekend. Need to restore from Velero backups.

**Findings:**
- Velero v1.15.0 with restic uploader (deprecated). All backups use restic.
- The restic backup for LLDAP's `lldap-data` PVC was taken successfully every 6 hours.
- However, the database in every backup contains only the default `admin` user.
- Volume restore creates PVs but the local-path provisioner binds the PVC to a NEW empty PV instead of the data-mover's PV.
- The data-mover on the velero server creates PVs with backup data, but they're garbage collected before the PVC binds to them.
- The volume restore's `PodVolumeRestoreAction` completes in under 1 second — no data is actually downloaded.
- The node-agent on the worker node never receives volume restore tasks for lldap-data.

**Root cause:** Velero's data-mover + restic uploader combo doesn't work correctly with the local-path provisioner. The data-mover creates PVs but the local-path provisioner creates separate PVs, and the data-mover's PVs are cleaned up.

**Workaround:** Delete the PVC, remove its finalizers, wait for deletion, then restore. The PVC gets bound but the volume data isn't populated.

**Status:** LLDAP is running with the restored PVC but database only has admin user. Latest backup (velero-0-20260727180019, July 27 18:00) is InProgress and should have the latest data. Will check once it completes.

**Next steps:**
1. Wait for velero-0-20260727180019 to complete
2. Delete PVC, restore from that backup
3. Verify database has users
4. Consider switching from restic to the new data-mover (fs-backup) in velero config
5. Or add a post-backup script that copies users.db to a known location for manual restore

---

## OpenNebula LDAP Auth (2026-07-14)

OpenNebula FireEdge (`one.becklab.cloud`) authenticates against LLDAP via NodePort.
- **Chain:** FireEdge → ONE core auth → ldap_auth.conf → LLDAP at `172.16.0.20:31389`
- **Bind DN:** `uid=admin,ou=people,dc=becklab,dc=cloud` (LLDAP requires full DN, not short name)
- **Group filter:** `cn=admins,ou=groups,dc=becklab,dc=cloud` — only admins group members can log in
- **Users auto-created** on first login via symlink `/var/lib/one/remotes/auth/default → ldap`
- **Admins group members:** yappingboy, aimeeyeghies, fuzzol, payduck
- **Key gotcha:** LLDAP rejects anonymous binds AND short usernames — `:user:` must be full DN
- Local auth (ssh/core) still works alongside for oneadmin/serveradmin

---

## Sub-Agent Roster (2026-07-19)

Agent configs in `agents/` directory. Each has a README.md.

| Agent | Type | Status |
|-------|------|--------|
| Chief of Branding | On-demand | Ready — blank canvas, awaiting "go" |
| Tech Support | Persistent (`session:techsupport`) | ⏸️ Parked — waiting on Telegram setup |
| Innovator | Cron (Sun 3AM PST) | ⚠️ Cron pending — tool validation issue with `name` field |
| GRC | Persistent (`session:grc`) | Ready |
| Documentarian | Persistent, reactive (`session:documentarian`) | Ready |
| SRE | Heartbeat checks | ✅ Active in HEARTBEAT.md |

- Developer role dropped (that's Nova)
- Release Manager role dropped (that's Nova, policy-enforced)
- Sales/Accounting tabled until BeckCloud becomes commercial

## Promoted From Short-Term Memory (2026-08-11)

<!-- openclaw-memory-promotion:memory:memory/2026-08-07.md:10:10 -->
- Root Cause: `http.ListenAndServe(mux)` Bug (AFFECTS ALL GO SERVICES): Builds retriggered for all. [score=0.815 recalls=0 avg=0.620 source=memory/2026-08-07.md:10-10]

### CADAM (2026-08-18)
- cadam.becklab.cloud: text-to-CAD (Adam-CAD/CADAM fork), `cadam` ns, Ollama at 172.16.0.7:11434
- Served at /cadam/ base path (Vite base /cadam, TanStack router basepath /cadam)
- Build: kaniko job in toolbox ns (flux/apps/cadam/build-job.yaml) — clones upstream, patches, builds
- SPA: nginx + _shell.html as index.html (static shell, no SSR)
- Image pinned by digest in app.yaml — bump after each rebuild
- Build pushes both latest-<build> and latest tags
- Vite build output: .output/public/ (nitro plugin overrides vite.config outDir)
- nginx serves html/cadam/ (built tree) with SPA fallback /cadam/index.html
- Gotcha: 'latest' tag + IfNotPresent + Flux 1m sync = race. Pin by digest.
- Gotcha: vite.config.ts outDir says dist/cadam but nitro emits to .output/public — trust the build log
