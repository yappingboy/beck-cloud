# BeckCloud Security Suite — Comprehensive Plan

**Authored:** 2026-07-08 by Nova (AI Sysadmin)  
**Last updated:** 2026-07-20
**Status:** Wazuh + Suricata + Crowdsec deployed; Trivy Operator blocked by resource quota; Falco still planned  
**Namespaces:** `security`, `crowdsec`  
**GitOps paths:** `flux/infrastructure/security/`, `flux/infrastructure/crowdsec/`  
**Last audited against current sources:** 2026-07-20

---

## Executive Summary

BeckCloud's security stack provides defense-in-depth across four complementary layers: runtime host monitoring, network traffic inspection, centralized log correlation and SIEM, and continuous vulnerability assessment. All four components operate within the `security` namespace and are managed through Flux CD GitOps alongside the rest of the cluster.

The suite is purpose-built for a two-node K3s homelab running on OpenNebula VMs — resource-aware, open-source only, and designed to integrate with existing Prometheus/Grafana/Alertmanager in `monitoring` and Keycloak SSO in `identity`.

### Current Deployment Status (2026-07-20)

| Component | Status | Notes |
|-----------|--------|-------|
| Wazuh (Manager + Indexer + Dashboard + Agents) | ✅ Deployed | Stable in `security` namespace. All pods Running with 0 restarts (fresh deployment ~6d ago). Dashboard has no IngressRoute yet. |
| Suricata (IDS) | ✅ Deployed | DaemonSet 2/2 Running, 0 restarts. Deployed ~5d ago in `security` namespace. |
| Crowdsec (LAPI + Agents + Traefik Bouncer) | ✅ Deployed | LAPI 1/1, agents 2/2, Traefik bouncer plugin v1.4.5 active in stream mode. Global middleware on web/websecure entrypoints. Local-only (no cloud enrollment). |
| Trivy Operator | ⚠️ Blocked | Deployment created but 0/1 pods — blocked by `security-quota` ResourceQuota (CPU limit 7350m, already using 7300m for Wazuh). Needs quota increase or Wazuh limits reduction. |
| Falco (HIDS) | 🔲 Planned | Previous deployment failed with eBPF driver crashes under KVM/Cilium. Not yet resolved. |

---

## Architecture Overview

```
Internet
  │
  ▼
Traefik v3.4.3 (:80/:443) ← cert-manager + Let's Encrypt
  │
  ├── crowdsec-bouncer middleware (global, stream mode)
  │     └── blocks IPs flagged by Crowdsec LAPI before they reach services
  │
  ├── sso-admin-chain (Keycloak + oauth2-proxy, /admins group required)
  │     └── wazuh.becklab.cloud → Wazuh Dashboard (planned, not yet routed)
  │
  ▼
K3s Cluster
  │
  ├── security namespace
  │     ├── Suricata (DaemonSet, 2/2)    ← IDS: network traffic inspection (detect-only)
  │     │     ├─ EVE JSON logs → Wazuh manager (via syslog port 514/TCP)
  │     │     └─ stats → Prometheus suricata_exporter (planned)
  │     ├── Wazuh Manager + Indexer      ← SIEM: centralized correlation, FIM, MITRE ATT&CK mapping
  │     │     ├─ ingests Suricata EVE logs
  │     │     └─ Dashboard exposed via wazuh.becklab.cloud (planned, no IngressRoute yet)
  │     └── Trivy Operator (⚠️ blocked)  ← VAS: continuous container + cluster vulnerability scanning
  │
  └── crowdsec namespace
        ├── Crowdsec LAPI (1 replica)    ← Central decision engine + ban list
        ├── Crowdsec Agent ×2 (DaemonSet) ← Log collectors (Traefik acquisition)
        └── Traefik Bouncer Plugin       ← Enforcement middleware in Traefik pods
```

**Traffic flow with Crowdsec:**
```
Request → Traefik → crowdsec-bouncer middleware
                       │
                       ├── IP clean? → Pass through to backend
                       └── IP banned? → 429 Too Many Requests (blocked)

Traefik access logs → Crowdsec Agent → LAPI → Scenario analysis
                                                    │
                                                    └── Ban decision → streamed back to bouncer
```

---

## Component Details

### 1. Falco — Host Intrusion Detection System (HIDS)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Runtime security monitoring for host and container behavior |
| **What it detects** | Suspicious syscalls, unauthorized container activity, privilege escalation attempts, unexpected network connections, filesystem modifications in sensitive paths, shell access to containers |
| **Deployment model** | DaemonSet (one pod per node) |
| **Driver** | `modern_ebpf` (preferred) with fallback to `kmod` if eBPF unavailable |
| **Chart** | `falco/falco` from Falcosecurity Helm repo (`https://falcosecurity.github.io/charts`) |
| **Latest chart version** | 9.1.x (check Artifact Hub before deployment) |
| **Output** | JSON to stdout, Prometheus metrics on :8777, configurable syslog output to Wazuh manager |
| **Resource footprint** | ~100-200 MiB RAM per node, negligible CPU overhead |

**Why Falco over Tetragon/KubeArmor:**
- CNCF Graduated project with the broadest community adoption and rule ecosystem
- Simpler to configure and maintain for a homelab environment
- Rules are human-readable YAML — easy to customize
- Tetragon offers kernel-level enforcement but adds complexity that isn't justified at this scale
- Can always layer Tetragon later if in-kernel blocking becomes necessary

**Known issues (documented 2026-07-08):**
- Previous deployment attempt failed with both `ebpf` and `modern_ebpf` drivers crashing under KVM/Cilium
- May require `kmod` driver + matching kernel headers, or waiting for upstream fixes
- See `flux/infrastructure/security/kustomization.yaml` comments for history

---

### 2. Suricata — Intrusion Detection System (IDS)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Deep packet inspection with signature-based and anomaly detection |
| **What it detects** | Known attack signatures (Emerging Threats ruleset), SQL injection, XSS, command injection, C2 traffic, cryptomining, DNS tunneling, port scanning, SSH brute force, Kubernetes-specific threats |
| **Deployment model** | DaemonSet with host networking for packet capture on all nodes |
| **Mode** | **IDS (detect-only)** initially; graduate to IPS after rule tuning |
| **Image** | `jasonish/suricata:8.0.6` |
| **Ruleset** | Emerging Threats Open (ETOpen) — free, community-maintained |
| **Output** | EVE JSON logs → forwarded to Wazuh manager (via wazuh-manager-worker:514/TCP syslog listener); Prometheus metrics via suricata_exporter |
| **Resource footprint** | ~200-500 MiB RAM per node, moderate CPU depending on traffic volume |
| **Live status** | ✅ 2/2 Running, 0 restarts, deployed ~5d10h ago |

**Live Pod Details (2026-07-20):**

| Pod | Ready | Status | Restarts | Age | Node |
|-----|-------|--------|----------|-----|------|
| `suricata-5nvxj` | 2/2 | Running | 0 | 5d10h | ip-172-16-0-20 (master) |
| `suricata-pz84g` | 2/2 | Running | 0 | 5d10h | ip-192-168-100-11 (worker) |

**Why Suricata over Snort/Zephyr:**
- Multithreaded architecture (Snort is single-threaded) — better for modern workloads
- Active development as of mid-2026 (Suricata 8.0 current)
- Native EVE JSON output integrates cleanly with SIEM ingestion
- Better performance on high-throughput environments

**Why IDS first, not IPS:**
- Prevents accidental service disruption from false positives during initial tuning
- Homelab environment benefits from a learning period before active blocking
- Graduating to IPS is straightforward — just change the deployment mode after rules are validated

---

### 3. Wazuh — SIEM + XDR Platform

| Attribute | Value |
|-----------|-------|
| **Purpose** | Centralized log correlation, intrusion detection, file integrity monitoring (FIM), compliance dashboards, MITRE ATT&CK mapping |
| **What it does** | Ingests alerts from Suricata EVE logs; correlates events against built-in rule sets; provides FIM across monitored hosts; generates compliance reports (PCI DSS, HIPAA, GDPR) |
| **Components** | Wazuh Manager + OpenSearch Indexer + Wazuh Dashboard (React UI) |
| **Chart** | `morgoved/wazuh-helm` (chart version 2.0.0, Wazuh 4.14.3) |
| **Ingestion sources** | Suricata (EVE JSON via syslog), system logs, FIM agents |
| **Dashboard access** | `wazuh.becklab.cloud` planned (admin SSO) — **no IngressRoute yet** |
| **Resource footprint** | ~4-6 GiB RAM for full stack (manager + indexer), moderate CPU — scheduled on server node via pod affinity |
| **Live status** | ✅ All components Running, 0 restarts (fresh deployment ~6d ago) |

**Live Pod Details (2026-07-20):**

| Pod | Ready | Status | Restarts | Age | Node |
|-----|-------|--------|----------|-----|------|
| `wazuh-manager-master-0` | 1/1 | Running | 0 | 6d4h | ip-172-16-0-20 |
| `wazuh-manager-worker-0` | 1/1 | Running | 0 | 6d4h | ip-172-16-0-20 |
| `wazuh-manager-worker-1` | 1/1 | Running | 0 | 6d4h | ip-172-16-0-20 |
| `wazuh-indexer-0` | 1/1 | Running | 0 | 6d5h | ip-172-16-0-20 |
| `wazuh-dashboard-54db68b7db-nwcv7` | 1/1 | Running | 3 | 10d | ip-172-16-0-20 |
| `wazuh-agent-mzch5` | 1/1 | Running | 115 | 6d20h | ip-172-16-0-20 |
| `wazuh-agent-v4jgm` | 1/1 | Running | 114 | 6d20h | ip-192-168-100-11 |

**Why Wazuh over Security Onion/Graylog/Elastic:**
- Security Onion is a resource hog requiring significantly more cores and RAM than our cluster provides
- Graylog excels at log management but lacks built-in security detection logic (it's a logging platform, not a SIEM)
- Elastic Security offers flexibility but has complex multi-component deployment that's overkill for homelab scale
- Wazuh ships with MITRE ATT&CK correlation, compliance dashboards, and active response out of the box — minimal configuration needed
- Best fit for our hardware (32 GB RAM per node)

**Resolution since last audit (2026-07-12):**
- Previous Wazuh pods had 641+ restarts — fresh deployment resolved this entirely
- All manager and indexer pods now show 0 restarts
- Agent pods have ~115 restarts each but these are from initial stabilization (~6d ago), not ongoing issues

---

### 4. Trivy Operator — Vulnerability Assessment System (VAS)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Continuous vulnerability scanning of container images, Kubernetes configurations, exposed secrets, and cluster components |
| **What it detects** | CVEs in OS packages and language dependencies, Kubernetes misconfigurations (OPA policies), exposed secrets in pods/configmaps, RBAC issues, CIS Kubernetes Benchmark compliance, Pod Security Standards violations |
| **Deployment model** | Deployment + CronJob-based scanning; watches K8s for pod creation to trigger scans automatically |
| **Chart** | `trivy-operator v0.32.0` (image: `mirror.gcr.io/aquasec/trivy-operator:0.30.0`) |
| **Output** | Kubernetes SecurityReports CRDs, ComplianceReports CRDs, SBOM generation; results queryable via `kubectl` and integrable with Wazuh |
| **Scan cadence** | Daily scheduled rescans + automatic scan on new pod creation |
| **Resource footprint** | ~256-512 MiB RAM during scans, idle otherwise; CPU limit: 500m |
| **Live status** | ⚠️ **Blocked by ResourceQuota** — deployment exists but 0/1 pods scheduled |

**Issue: ResourceQuota Blocking Trivy Operator**

The `security-quota` ResourceQuota limits CPU to 7350m in the security namespace. Wazuh stack currently uses ~7300m, leaving only 50m available. Trivy Operator requests 500m CPU, which exceeds the remaining quota.

```
Error creating: pods "trivy-operator-d4664ff87-xxxxx" is forbidden:
exceeded quota: security-quota, requested: limits.cpu=500m,
used: limits.cpu=7300m, limited: limits.cpu=7350m
```

**Resolution options:**
1. **Increase `security-quota` CPU limit** — e.g., from 7350m to 8000m
2. **Reduce Wazuh resource limits** — manager and indexer limits may have headroom
3. **Move Trivy to separate namespace** — e.g., `security-scanning` with its own quota

**Why Trivy Operator over standalone Trivy CLI:**
- Kubernetes-native — results appear as CRDs queryable via the K8s API
- Automatic re-scanning on workload changes (no manual cron management)
- Built-in compliance reporting (CIS Benchmark, NSA/CISA hardening guidance, Pod Security Standards)
- Generates SBOMs for all workloads automatically
- Better integration with Wazuh than CLI output parsing

**Why Trivy over Grype/Clair:**
- Both detect the same CVEs (same NVD source), but Trivy has broader scope beyond container images
- Scans Kubernetes configurations, IaC, secrets, and cluster components in addition to images
- Single tool covers more attack surface without adding another dependency

---

### 5. Crowdsec — Application-Level WAF + IP Reputation

| Attribute | Value |
|-----------|-------|
| **Purpose** | Behavioral analysis + IP reputation WAF that blocks malicious traffic at the ingress edge |
| **What it detects** | Brute force login attempts, directory scanning, path traversal, API abuse, known malicious IPs (community CTI when enrolled), rate limiting violations |
| **Deployment model** | LAPI (1 replica) + Agents (1 per node) in `crowdsec` namespace; bouncer plugin runs inside Traefik pods |
| **Chart** | `crowdsec/crowdsec` v0.20.0 from `https://crowdsecurity.github.io/helm-charts` |
| **Bouncer** | `maxlerebourg/crowdsec-bouncer-traefik-plugin` v1.4.5 (experimental Traefik plugin) |
| **Mode** | Stream mode — real-time decision streaming from LAPI to bouncer via HTTP long-poll |
| **Scope** | Global — applied to all traffic on `web` and `websecure` entrypoints via Traefik `additionalArguments` |
| **Enrollment** | Local-only (no Crowdsec cloud console). Community CTI available by adding `ENROLL_KEY` |
| **Resource footprint** | LAPI ~128-256 MiB RAM; agents ~64 MiB each; bouncer plugin negligible (runs in Traefik process) |
| **Live status** | ✅ LAPI 1/1, agents 2/2, bouncer streaming active |

**Architecture:**
```
Crowdsec Agent (per node)
  │
  ├── Watches Traefik pods (namespace: traefik, program: traefik)
  │     └── Parses access logs → sends to LAPI
  │
  ▼
Crowdsec LAPI (:8080)
  │
  ├── Runs scenarios against log events
  │     ├── crowdsecurity/traefik (built-in)
  │     └── crowdsecurity/cti (community threat intel, when enrolled)
  │
  ├── Maintains ban list (in-memory + SQLite/PV)
  │
  └── Streams decisions to bouncer
        │
        ▼
Traefik Bouncer Plugin (in Traefik pods)
  │
  ├── Polls LAPI for decision stream
  │
  └── On each incoming request:
        ├── Check IP against ban list
        │     ├── Banned → return 429
        │     └── Clean → pass to next middleware (SSO, routing, etc.)
```

**Why Crowdsec over fail2ban/mosn/Coraza:**
- fail2ban is host-level, doesn't integrate with Kubernetes ingress controllers
- Coraza (ModSecurity replacement) is more complex and focused on WAF rulesets only
- Crowdsec provides both behavioral analysis AND community threat intelligence
- Traefik plugin is lightweight (runs in-process, no sidecar overhead)
- Open-source with active community and built-in scenarios for common attack patterns
- Can graduate to cloud enrollment later for community CTI without architectural changes

**Key files:**
```
flux/infrastructure/crowdsec/
├── kustomization.yaml
├── namespace.yaml              # crowdsec namespace
├── secrets.yaml                # SOPS-encrypted (BOUNCER_KEY_traefik)
├── helmrelease.yaml            # LAPI + agents (chart v0.20.0)
└── bouncer-middleware.yaml     # Traefik Middleware CRD
```

**Bouncer key management:**
- `crowdsec-keys` secret in `crowdsec` namespace — LAPI reads `BOUNCER_KEY_traefik`
- `crowdsec-bouncer-key` secret in `traefik` namespace — Traefik mounts as file at `/etc/traefik/crowdsec/`
- Both contain the same key, encrypted with SOPS + age

---

## Integration Architecture

### Alert Flow

```
Suricata EVE     ───▶ Wazuh Manager ───▶ OpenSearch Indexer ───▶ Dashboard (wazuh.becklab.cloud)
                                                         (MITRE ATT&CK + compliance views)

Trivy CRDs       ───▶ Kubernetes API ───▶ Wazuh correlation rules ───▶ Dashboard
                  (⚠️ currently blocked)

All components   ───▶ Prometheus metrics ───▶ Grafana dashboards (grafana.becklab.cloud)
```

### Alertmanager Integration

All tools expose Prometheus-compatible metrics that can be scraped by the existing `kube-prometheus-stack` in the `monitoring` namespace:

- **Suricata:** `suricata_exporter` provides packet counters, alert counts, rule hit rates
- **Wazuh:** Custom Prometheus exporter available for manager stats (active agents, alerts/sec)
- **Trivy Operator:** Kubernetes metrics via standard kube-state-metrics integration (⚠️ currently blocked)

High-severity findings from any tool can trigger Alertmanager notifications to configured channels.

---

## Deployment Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Create/update `security` namespace with proper labels and network policies
- [x] Deploy Wazuh stack — SIEM hub, all components stable (0 restarts)
- [ ] Configure Wazuh dashboard ingress (`wazuh.becklab.cloud`, admin SSO, TLS via cert-manager)
- [x] Add Wazuh HelmRepository to Flux sources (morgoved/wazuh-helm chart 2.0.0)
- [ ] Verify Wazuh dashboard is accessible and authenticated

### Phase 2: HIDS + VAS — PARTIAL
- [ ] Deploy Trivy Operator — **blocked by ResourceQuota**, needs quota increase before pod can schedule
- [ ] Configure daily scan schedule and severity thresholds
- [ ] Deploy Falco — resolve eBPF/kmod driver issue from previous attempt
- [ ] Wire Falco alerts to Wazuh manager via syslog or JSON output

### Phase 3: IDS ✅ COMPLETE
- [x] Deploy Suricata in IDS mode (detect-only) — 2/2 Running, stable
- [x] Configure Emerging Threats ruleset (bundled in jasonish/suricata image)
- [x] Pipe EVE logs to Wazuh for correlation (via wazuh-manager-worker:514/TCP syslog listener)
- [ ] Validate alert accuracy, tune false positives
- [ ] Add Prometheus exporter scrape config

### Phase 4: Integration Hardening (Week 4)
- [ ] Verify all tools are reporting to Wazuh dashboard coherently
- [ ] Create custom Grafana dashboards correlating security metrics across tools
- [ ] Configure Alertmanager routing for critical security alerts
- [ ] Document runbook procedures in `docs/runbooks/procedures-runbook.md`
- [ ] Add network policies isolating `security` namespace traffic

### Phase 5: WAF + Edge Protection ✅ COMPLETE
- [x] Deploy Crowdsec LAPI + agents in `crowdsec` namespace
- [x] Add HelmRepository (`crowdsecurity.github.io/helm-charts`)
- [x] Install Traefik bouncer plugin v1.4.5 (experimental plugin)
- [x] Create `crowdsec-bouncer` Middleware, apply globally to web/websecure
- [x] Bouncer key in SOPS-encrypted secrets (crowdsec-keys + crowdsec-bouncer-key)
- [x] Verify stream mode connection (LAPI → bouncer decision stream)
- [ ] Optional: enroll with app.crowdsec.net for community CTI
- [ ] After Suricata rule tuning is validated, switch from IDS to IPS mode
- [ ] Test with non-critical namespaces first (`gaming`, then `media`)
- [ ] Monitor for false positive blocks before enabling cluster-wide

---

### Future: IPS Upgrade (After Phase 4)
- [ ] After Suricata rule tuning is validated, switch from IDS to IPS mode
- [ ] Test with non-critical namespaces first (`gaming`, then `media`)
- [ ] Monitor for false positive blocks before enabling cluster-wide

---

## GitOps Structure

```
flux/infrastructure/security/
├── kustomization.yaml          # Namespace + all HelmReleases
├── namespace.yaml              # security namespace definition
├── falco.yaml                  # Falco HelmRelease (falcosecurity/falco)
├── wazuh/filebeat-configmap.yaml
├── wazuh/wazuh-values.yaml
├── suricata/                   # Suricata DaemonSet
└── trivy-operator/             # Trivy Operator

flux/infrastructure/crowdsec/   # Separate ns to avoid kustomize ns-transform conflict
├── kustomization.yaml
├── namespace.yaml              # crowdsec namespace
├── secrets.yaml                # SOPS-encrypted bouncer key
├── helmrelease.yaml            # Crowdsec LAPI + agents
└── bouncer-middleware.yaml     # Traefik Middleware CRD
```

Corresponding source additions:
- `flux/infrastructure/sources/helm-repositories.yaml` — add repos for Wazuh, Trivy, Suricata

---

## Helm Repository Sources Required

Add the following to `flux/infrastructure/sources/helm-repositories.yaml`:

| Name | URL | Purpose |
|------|-----|---------|
| `falco` | `https://falcosecurity.github.io/charts` | ✅ Already defined |
| `wazuh` | Morgoved's Helm repo (GitHub Packages or OCI) | ✅ Wazuh Manager + Indexer + Dashboard |
| `aqua` | `https://aquasecurity.github.io/helm-charts/` | ✅ Trivy Operator (chart 0.32.0) |
| `crowdsec` | `https://crowdsecurity.github.io/helm-charts` | ✅ Crowdsec LAPI + agents (chart 0.20.0) |

Suricata has no official public Helm repo — uses a custom Kustomization overlay wrapping the `locustbaby/suricata-charts` manifests.

---

## Resource Budget (Actual vs Estimated)

| Component | CPU Request | Memory Request | Notes |
|-----------|-------------|----------------|-------|
| Suricata ×2 nodes | 100m each | 256Mi each | DaemonSet, scales with traffic |
| Wazuh Manager | 500m | 2Gi | Pinned to server node |
| Wazuh Indexer (OpenSearch) | 500m | 3Gi | Pinned to server node, needs PVC |
| Wazuh Dashboard | 100m | 512Mi | Server node preferred |
| Wazuh Agent ×2 nodes | — | — | DaemonSet, minimal overhead |
| Trivy Operator | 500m | 256Mi | ⚠️ Blocked — quota exceeded |
| Crowdsec LAPI | — | ~128-256Mi | In `crowdsec` namespace (separate quota) |
| Crowdsec Agent ×2 | — | ~64Mi each | DaemonSet in `crowdsec` namespace |

**Total estimated:** ~1.3 CPU cores, ~7-8 GiB RAM across the suite  
**Server node remaining after Wazuh stack:** ~24 GiB free (of 32 GiB) — comfortable margin  
**ResourceQuota issue:** `security-quota` caps CPU at 7350m; Wazuh uses ~7300m, blocking Trivy's 500m request

---

## Network Policies

The `security` namespace will have default-deny ingress/egress policies with explicit allow rules:

| Source | Destination | Port | Purpose |
|--------|-------------|------|---------|
| Any pod → Suricata exporter | 9677/TCP | Prometheus scraping |
| Wazuh Manager | 55000/TCP | Agent registration and alert ingestion |
| Wazuh Dashboard | 443/TCP | External access via Traefik ingress (planned) |
| Trivy Operator → Kube API | 6443/TCP | CRD reading/writing |
| Suricata → Wazuh Manager | 514/TCP | EVE JSON log forwarding via syslog |

All inter-component traffic stays within the cluster — no services except Wazuh Dashboard are externally exposed.

---

## SSO Integration

The Wazuh Dashboard at `wazuh.becklab.cloud` uses the existing admin authentication chain:

- **Middleware:** `sso-admin-chain` (in `identity` namespace)
  - Stage 1: `oauth2-redirect` middleware
  - Stage 2: `keycloak-forwardauth` (oauth2-proxy, requires `/admins` Keycloak group)
- Same pattern as Grafana, Traefik dashboard, Hubble UI, Silex, and Directus
- Stephen's Keycloak account must be a member of the `/admins` group in LLDAP
- **TLS certificate `wazuh-becklab-cloud-tls` exists** but no IngressRoute deployed yet

---

## Monitoring & Observability

All security tools feed into existing observability:

1. **Grafana** (`grafana.becklab.cloud`) — Custom dashboards for:
   - Suricata traffic stats, top signatures, protocol distribution
   - Wazuh alert volume, agent status, FIM changes
   - Trivy vulnerability trends (new CVEs per scan, severity distribution) — ⚠️ currently blocked

2. **Alertmanager** — Critical alerts route to configured notification channels:
   - Suricata high-severity rule matches (C2 communication, exploit signatures)
   - Wazuh critical alerts (file integrity changes in /etc, suspicious processes)

3. **Prometheus** — All tools expose metrics on standard HTTP endpoints scraped by `kube-prometheus-stack`

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Trivy Operator blocked by ResourceQuota | VAS non-functional | Increase `security-quota` CPU limit or reduce Wazuh limits; see Trivy section for options |
| Wazuh stack exceeds node memory | Node OOM, pod evictions | Pod affinity pins to server (32 GB); resource limits enforce ceiling; monitor actual usage and adjust |
| Suricata IDS generates excessive false positives | Alert fatigue | Start in IDS mode only; tune rules over 1-2 weeks before considering IPS |
| Trivy scan storms during peak hours | CPU/memory spikes on worker | Schedule daily scans during off-peak (03:00 PST); auto-scans on pod creation are lightweight per-image |
| Security namespace becomes single point of failure | Blindness to all security events | Critical alerts also route to Alertmanager independently; Wazuh has built-in clustering for future HA |
| Falco eBPF driver crashes under KVM/Cilium | HIDS non-functional | Fall back to `kmod` driver; if that fails, revisit with kernel header alignment or defer to Tetragon |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Falco over Tetragon for HIDS | Simpler, broader rule ecosystem, sufficient for homelab scale; Tetragon available later if enforcement needed |
| 2026-07-08 | Suricata in IDS mode initially | Prevent accidental disruption during tuning period; graduate to IPS after validation |
| 2026-07-08 | Wazuh over Security Onion for SIEM | SO resource requirements exceed cluster capacity; Wazuh provides full SIEM+XDR at feasible footprint |
| 2026-07-08 | Trivy Operator over CLI-only VAS | Kubernetes-native CRDs, automatic re-scanning, compliance reporting built-in |
| 2026-07-08 | Wazuh Dashboard externally accessible via admin SSO | Consistent with existing admin tooling pattern (Grafana, Traefik, Hubble); Stephen requested admin SSO access |
| 2026-07-08 | Daily Trivy scan cadence | Balances freshness of vulnerability data against resource consumption; can increase frequency later if needed |
| 2026-07-20 | Suricata deployed (was planned) | 2/2 Running stable in `security` namespace, EVE JSON → Wazuh via syslog |
| 2026-07-20 | Wazuh re-deployed (was unstable) | Fresh deployment resolved 641+ restart issue; all pods now stable with 0 restarts |
| 2026-07-20 | Trivy Operator blocked by quota | `security-quota` CPU limit (7350m) exceeded by Wazuh stack (~7300m); needs adjustment before Trivy can schedule |
| 2026-07-20 | Crowdsec deployed | LAPI + agents in dedicated `crowdsec` namespace; Traefik bouncer plugin v1.4.5 in stream mode; global middleware on web/websecure entrypoints; local-only (no cloud enrollment) |

---

## References

- **Falco:** https://falco.org/docs/setup/kubernetes/ (Helm install guide, updated March 2026)
- **Suricata:** https://suricata.io/about/suricata-8/ (v8.0 release notes)
- **Wazuh:** https://documentation.wazuh.com/current/deployment-options/deploying-with-kubernetes/kubernetes-deployment.html
- **Morgoved Wazuh Helm Chart:** https://github.com/morgoved/wazuh-helm (tested with Wazuh 4.14.x, chart 2.0.0)
- **Trivy Operator:** https://github.com/aquasecurity/trivy-operator (chart v0.32.0, image 0.30.0)
- **ARMO OSS K8s Security Tools (Jan 2026):** https://www.armosec.io/blog/best-open-source-kubernetes-security-tools/
- **Cilium Falco→Tetragon Migration Guide (Jan 2026):** https://cilium.io/blog/2026/01/19/tetragon-falco-migrate/
- **Crowdsec:** https://github.com/crowdsecurity/helm-charts (chart v0.20.0, agent v1.7.0)
- **Crowdsec Traefik Plugin:** https://github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin (v1.4.5)

---

*End of security suite plan. Updated from live cluster data 2026-07-20.*
