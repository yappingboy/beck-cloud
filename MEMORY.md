# MEMORY.md — Nova's Long-Term Memory

## BeckCloud Infrastructure (Updated 2026-07-08)

**CRITICAL: Read this before any cluster work.** This is the core knowledge I need every session.

### Cluster at a Glance
- **Platform:** K3s v1.32.0+k3s1 on Ubuntu 24.04 VMs (OpenNebula CE 7.2 AIO, AlmaLinux 9 host "becklab")
- **Nodes:** k3s-server (172.16.0.20 / 192.168.100.10) + k3s-worker-1 (192.168.100.11, ProxyJump via server)
- **CNI:** Cilium v1.17.0 with Hubble
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
- **Crowdsec bouncer:** `crowdsec-bouncer` middleware applied globally to web/websecure entrypoints (stream mode, blocks banned IPs before SSO)
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

### Keycloak Monitoring Client (for authenticated API testing)
- Realm: homelab, Client: nova-monitoring, User: yappingboy
- Token URL: https://keycloak.becklab.cloud/realms/homelab/protocol/openid-connect/token
- See TOOLS.md for credentials

### Lessons Learned
1. Don't spawn subagents for data collection — they burn tokens before writing files. Collect + write in same session.
2. kubectl connectivity from the sandbox can drop mid-session. If it does, collect what you can and proceed with cached data.
3. Media services (Jellyfin, Sonarr, etc.) currently have NO IngressRoutes despite having TLS certs — they're internal-only right now. Don't assume they're externally accessible.
4. When MEMORY.md already has a section about something, read it first before treating the task as fresh work.
5. Run Ansible playbooks to apply changes, don't do manual SSH edits and write the playbook afterward.
6. NEVER store passwords in plaintext YAML — even temporarily, even in private repos. Use SOPS (with --ignore-mac if needed), sealed secrets, or external secret managers. If Git history gets polluted, force-push to clean it.

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

## Promoted From Short-Term Memory (2026-07-14)

<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:13:16 -->
- What worked tonight (second attempt, 17:24 UTC onward): Collected all data directly in this session via exec commands — no subagents; Ran ~30+ kubectl queries covering nodes, deployments, services, IngressRoutes, HelmReleases, Kustomizations, PVs/PVCs, certificates, Velero schedules, SSO middleware chains, DaemonSets, StatefulSets; Wrote 7 documentation files totaling ~58KB:; `docs/research/system-overview.md` — Executive summary + full infrastructure map (15.7KB) [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:13-16]
<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:17:20 -->
- What worked tonight (second attempt, 17:24 UTC onward): `docs/research/services-catalog.md` — Every service detailed (9KB); `docs/research/networking-ingress.md` — Traefik, SSO chains, TLS (7.5KB); `docs/research/storage-backups.md` — PVs, Velero, capacity (6.8KB); `docs/research/gitops-automation.md` — Flux pipeline, Ansible, SOPS (8.5KB) [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:17-20]
<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:21:24 -->
- What worked tonight (second attempt, 17:24 UTC onward): `docs/research/procedures-runbook.md` — Ops procedures, troubleshooting (8.7KB); `docs/index.md` — Documentation index/navigation (2.1KB); Committed and pushed to GitHub as `c028489` on main branch; Created MEMORY.md with persistent cluster knowledge for future sessions [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:21-24]
<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:27:30 -->
- Key findings from audit: 45+ deployments, all healthy (1/1 ready across the board); 8 HelmReleases managed by Flux; 5 Velero backup schedules covering identity/every-6h, security/daily, media/daily, cattle-system/daily, full-cluster/weekly; ~140 TiB of media storage on LVM PVs (NOT backed up) [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:27-30]
<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:5:5 -->
- Documentation Audit (major task): Stephen requested comprehensive, layered documentation of the entire BeckCloud server environment + persistent knowledge retention. [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:5-5]
<!-- openclaw-memory-promotion:memory:memory/2026-07-08.md:8:10 -->
- What went wrong earlier: First attempt: spawned two subagents for parallel deep audits — both ran out of tokens before writing files (~33k and ~93k tokens burned with zero output on disk); Session expired multiple times due to long runtime; kubectl connectivity dropped mid-session at some point [score=0.845 recalls=0 avg=0.620 source=memory/2026-07-08.md:8-10]
<!-- openclaw-memory-promotion:memory:memory/2026-07-10-0140.md:12:14 -->
- Conversation Summary: **Keycloak** → stuck starting, fails liveness probe after ~20min, restarts (loop); **oauth2-proxy × 2** → crashes trying to connect to Keycloak (`503: no available server`); **user-invite** → likely depends on Keycloak too [score=0.825 recalls=0 avg=0.620 source=memory/2026-07-10-0140.md:12-14]
<!-- openclaw-memory-promotion:memory:memory/2026-07-10-0140.md:16:17 -->
- Conversation Summary: Keycloak is stuck on "Updating the configuration and installing your custom providers." Let me check if it's a resource issue or a config problem: assistant: OK, here's the summary: [score=0.825 recalls=0 avg=0.620 source=memory/2026-07-10-0140.md:16-17]
<!-- openclaw-memory-promotion:memory:memory/2026-07-10-0140.md:19:19 -->
- Conversation Summary: **What was crashing:** [score=0.825 recalls=0 avg=0.620 source=memory/2026-07-10-0140.md:19-19]
<!-- openclaw-memory-promotion:memory:memory/2026-07-10-0140.md:3:5 -->
- Session: 2026-07-10 01:40:59 UTC: **Session Key**: agent:main:telegram:direct:7070537908; **Session ID**: 7971794b-b359-422b-a01a-8a32b6cbecc6; **Source**: telegram [score=0.825 recalls=0 avg=0.620 source=memory/2026-07-10-0140.md:3-5]
