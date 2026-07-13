# BeckCloud Security Suite — Comprehensive Plan

**Authored:** 2026-07-08 by Nova (AI Sysadmin)  
**Last updated:** 2026-07-12
**Status:** Partially deployed — Wazuh + Trivy Operator active; Falco + Suricata still planned  
**Namespace:** `security`  
**GitOps path:** `flux/infrastructure/security/`  
**Last audited against current sources:** 2026-07-08

---

## Executive Summary

BeckCloud's security stack provides defense-in-depth across four complementary layers: runtime host monitoring, network traffic inspection, centralized log correlation and SIEM, and continuous vulnerability assessment. All four components operate within the `security` namespace and are managed through Flux CD GitOps alongside the rest of the cluster.

The suite is purpose-built for a two-node K3s homelab running on OpenNebula VMs — resource-aware, open-source only, and designed to integrate with existing Prometheus/Grafana/Alertmanager in `monitoring` and Keycloak SSO in `identity`.

### Current Deployment Status (2026-07-12)

| Component | Status | Notes |
|-----------|--------|-------|
| Wazuh (Manager + Indexer + Dashboard + Agents) | ✅ Deployed | Active in `security` namespace. Manager pods have high restart counts (641+) — investigating resource/config issues. No external IngressRoute yet.
| Trivy Operator | ✅ Deployed | Active in `trivy-system` namespace. Continuous scanning operational.
| Falco (HIDS) | 🔲 Planned | Previous deployment failed with eBPF driver crashes under KVM/Cilium. Not yet resolved.
| Suricata (IDS) | ✅ Deployed | DaemonSet on all nodes, IDS mode, EVE JSON → Wazuh via syslog port 514/TCP. ETOpen ruleset bundled in jasonish/suricata:8.0.6.

---

## Architecture Overview

```
Internet
  │
  ▼
Traefik v3.4.3 (:80/:443) ← cert-manager + Let's Encrypt
  │
  ├── sso-admin-chain (Keycloak + oauth2-proxy, /admins group required)
  │     └── wazuh.becklab.cloud → Wazuh Dashboard (SIEM console)
  │
  ▼
K3s Cluster — security namespace
  │
  ├── Falco (DaemonSet)         ← HIDS: runtime host/container behavior detection
  │     └── alerts → Prometheus metrics + stdout/syslog
  │
  ├── Suricata (DaemonSet)      ← IDS: network traffic inspection (detect-only initially)
  │     ├─ EVE JSON logs → Wazuh manager (via Filebeat/forwarder)
  │     └─ stats → Prometheus suricata_exporter
  │
  ├── Wazuh Manager + Indexer   ← SIEM: centralized correlation, FIM, MITRE ATT&CK mapping
  │     ├─ ingests Falco alerts
  │     ├─ ingests Suricata EVE logs
  │     ├─ ingests Trivy vulnerability reports
  │     └─ Dashboard exposed via wazuh.becklab.cloud (admin SSO)
  │
  └── Trivy Operator            ← VAS: continuous container + cluster vulnerability scanning
        ├─ scans on pod creation + daily scheduled rescans
        └─ results → Kubernetes SecurityReports CRDs → Wazuh correlation
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
| **Chart** | Custom Kustomization wrapping `locustbaby/suricata-charts` (DaemonSet + Prometheus exporter) |
| **Ruleset** | Emerging Threats Open (ETOpen) — free, community-maintained |
| **Output** | EVE JSON logs → forwarded to Wazuh manager; Prometheus metrics via suricata_exporter |
| **Resource footprint** | ~200-500 MiB RAM per node, moderate CPU depending on traffic volume |

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
| **What it does** | Ingests alerts from Falco, Suricata EVE logs, Trivy vulnerability reports; correlates events against built-in rule sets; provides FIM across monitored hosts; generates compliance reports (PCI DSS, HIPAA, GDPR) |
| **Components** | Wazuh Manager + OpenSearch Indexer + Wazuh Dashboard (React UI) |
| **Chart** | `morgoved/wazuh-helm` (the actively maintained fork of the deprecated Ca-moes chart; tested with Wazuh 4.14.x) |
| **Ingestion sources** | Falco (syslog/JSON), Suricata (EVE JSON via Filebeat), Trivy Operator (Kubernetes CRDs), system logs, FIM agents |
| **Dashboard access** | `wazuh.becklab.cloud` with admin SSO chain (`sso-admin-chain`, requires `/admins` Keycloak group) |
| **Resource footprint** | ~4-6 GiB RAM for full stack (manager + indexer), moderate CPU — scheduled on server node via pod affinity |

**Why Wazuh over Security Onion/Graylog/Elastic:**
- Security Onion is a resource hog requiring significantly more cores and RAM than our cluster provides
- Graylog excels at log management but lacks built-in security detection logic (it's a logging platform, not a SIEM)
- Elastic Security offers flexibility but has complex multi-component deployment that's overkill for homelab scale
- Wazuh ships with MITRE ATT&CK correlation, compliance dashboards, and active response out of the box — minimal configuration needed
- Best fit for our hardware (32 GB RAM per node)

**Deployment considerations:**
- Previous HelmRelease defined chart version 4.9.0 from a deprecated repo — will migrate to `morgoved/wazuh-helm`
- Manager and indexer need PersistentVolumeClaims (local-path provisioner or MinIO-backed)
- Pod affinity should pin Wazuh stack to the server node (`ip-172-16-0-20`) for RAM headroom
- Dashboard ingress uses `sso-admin-chain` in `identity` namespace

---

### 4. Trivy Operator — Vulnerability Assessment System (VAS)

| Attribute | Value |
|-----------|-------|
| **Purpose** | Continuous vulnerability scanning of container images, Kubernetes configurations, exposed secrets, and cluster components |
| **What it detects** | CVEs in OS packages and language dependencies, Kubernetes misconfigurations (OPA policies), exposed secrets in pods/configmaps, RBAC issues, CIS Kubernetes Benchmark compliance, Pod Security Standards violations |
| **Deployment model** | Deployment + CronJob-based scanning; watches K8s for pod creation to trigger scans automatically |
| **Chart** | `aqua/trivy-operator` from Aqua Helm repo (`https://aquasecurity.github.io/helm-charts/`) or OCI `ghcr.io/aquasecurity/helm-charts/trivy-operator` |
| **Latest chart version** | 0.34.x (as of July 2026) |
| **Output** | Kubernetes SecurityReports CRDs, ComplianceReports CRDs, SBOM generation; results queryable via `kubectl` and integrable with Wazuh |
| **Scan cadence** | Daily scheduled rescans + automatic scan on new pod creation |
| **Resource footprint** | ~256-512 MiB RAM during scans, idle otherwise |

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

## Integration Architecture

### Alert Flow

```
Falco detection  ─┐
                  ├──▶ Wazuh Manager ───▶ OpenSearch Indexer ───▶ Dashboard (wazuh.becklab.cloud)
Suricata EVE     ──┘                                         (MITRE ATT&CK + compliance views)

Trivy CRDs       ───▶ Kubernetes API ───▶ Wazuh correlation rules ───▶ Dashboard

All components   ───▶ Prometheus metrics ───▶ Grafana dashboards (grafana.becklab.cloud)
```

### Alertmanager Integration

All four tools expose Prometheus-compatible metrics that can be scraped by the existing `kube-prometheus-stack` in the `monitoring` namespace:

- **Falco:** Built-in HTTP metrics on port 8777 (`falco_errors_total`, `falco_json_output_errors_total`, etc.)
- **Suricata:** `suricata_exporter` provides packet counters, alert counts, rule hit rates
- **Wazuh:** Custom Prometheus exporter available for manager stats (active agents, alerts/sec)
- **Trivy Operator:** Kubernetes metrics via standard kube-state-metrics integration

High-severity findings from any tool can trigger Alertmanager notifications to configured channels.

---

## Deployment Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Create/update `security` namespace with proper labels and network policies
- [x] Deploy Wazuh stack first — it's the SIEM hub that everything feeds into
- [ ] Configure Wazuh dashboard ingress (`wazuh.becklab.cloud`, admin SSO, TLS via cert-manager)
- [ ] Add Wazuh HelmRepository to Flux sources
- [ ] Verify Wazuh dashboard is accessible and authenticated

### Phase 2: HIDS + VAS — PARTIAL
- [x] Deploy Trivy Operator — lightweight, immediate value, no driver dependencies
- [x] Configure daily scan schedule and severity thresholds
- [ ] Deploy Falco — resolve eBPF/kmod driver issue from previous attempt
- [ ] Wire Falco alerts to Wazuh manager via syslog or JSON output

### Phase 3: IDS ✅ COMPLETE
- [x] Deploy Suricata in IDS mode (detect-only)
- [x] Configure Emerging Threats ruleset (bundled in jasonish/suricata image)
- [x] Pipe EVE logs to Wazuh for correlation (via wazuh-manager-worker:514/TCP syslog listener)
- [ ] Validate alert accuracy, tune false positives
- [ ] Add Prometheus exporter scrape config

### Phase 4: Integration Hardening (Week 4)
- [ ] Verify all four tools are reporting to Wazuh dashboard coherently
- [ ] Create custom Grafana dashboards correlating security metrics across tools
- [ ] Configure Alertmanager routing for critical security alerts
- [ ] Document runbook procedures in `docs/research/procedures-runbook.md`
- [ ] Add network policies isolating `security` namespace traffic

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
├── wazuh-manager.yaml          # Wazuh Manager + Indexer HelmRelease (morgoved/wazuh-helm)
├── wazuh-dashboard.yaml        # Wazuh Dashboard + Ingress
├── suricata.yaml               # Suricata DaemonSet + exporter Kustomization
└── trivy-operator.yaml         # Trivy Operator HelmRelease (aqua/trivy-operator)
```

Corresponding source additions:
- `flux/infrastructure/sources/helm-repositories.yaml` — add repos for Wazuh, Trivy, Suricata

---

## Helm Repository Sources Required

Add the following to `flux/infrastructure/sources/helm-repositories.yaml`:

| Name | URL | Purpose |
|------|-----|---------|
| `falco` | `https://falcosecurity.github.io/charts` | ✅ Already defined |
| `wazuh` | Morgoved's Helm repo (GitHub Packages or OCI) | Wazuh Manager + Indexer + Dashboard |
| `aqua` | `https://aquasecurity.github.io/helm-charts/` | Trivy Operator |

Suricata has no official public Helm repo — will use a custom Kustomization overlay wrapping the `locustbaby/suricata-charts` manifests, or package as an OCI chart.

---

## Resource Budget (Estimated)

| Component | CPU Request | Memory Request | Notes |
|-----------|-------------|----------------|-------|
| Falco ×2 nodes | 50m each | 128Mi each | DaemonSet, minimal overhead |
| Suricata ×2 nodes | 100m each | 256Mi each | DaemonSet, scales with traffic |
| Wazuh Manager | 500m | 2Gi | Pinned to server node |
| Wazuh Indexer (OpenSearch) | 500m | 3Gi | Pinned to server node, needs PVC |
| Wazuh Dashboard | 100m | 512Mi | Server node preferred |
| Trivy Operator | 100m | 256Mi | Light when idle |

**Total estimated:** ~1.3 CPU cores, ~7-8 GiB RAM across the suite  
**Server node remaining after Wazuh stack:** ~24 GiB free (of 32 GiB) — comfortable margin

---

## Network Policies

The `security` namespace will have default-deny ingress/egress policies with explicit allow rules:

| Source | Destination | Port | Purpose |
|--------|-------------|------|---------|
| Any pod → Falco metrics | 8777/TCP | Prometheus scraping |
| Wazuh Manager | 55000/TCP | Agent registration and alert ingestion |
| Wazuh Dashboard | 443/TCP | External access via Traefik ingress |
| Trivy Operator → Kube API | 6443/TCP | CRD reading/writing |
| Suricata → Prometheus | 9677/TCP (exporter) | Metrics scraping |

All inter-component traffic stays within the cluster — no services except Wazuh Dashboard are externally exposed.

---

## SSO Integration

The Wazuh Dashboard at `wazuh.becklab.cloud` uses the existing admin authentication chain:

- **Middleware:** `sso-admin-chain` (in `identity` namespace)
  - Stage 1: `oauth2-redirect` middleware
  - Stage 2: `keycloak-forwardauth` (oauth2-proxy, requires `/admins` Keycloak group)
- Same pattern as Grafana, Traefik dashboard, Hubble UI, Silex, and Directus
- Stephen's Keycloak account must be a member of the `/admins` group in LLDAP

---

## Monitoring & Observability

All security tools feed into existing observability:

1. **Grafana** (`grafana.becklab.cloud`) — Custom dashboards for:
   - Falco alert rates and top rule triggers
   - Suricata traffic stats, top signatures, protocol distribution
   - Wazuh alert volume, agent status, FIM changes
   - Trivy vulnerability trends (new CVEs per scan, severity distribution)

2. **Alertmanager** — Critical alerts route to configured notification channels:
   - Falco critical events (privilege escalation, container breakout attempts)
   - Suricata high-severity rule matches (C2 communication, exploit signatures)
   - Wazuh critical alerts (file integrity changes in /etc, suspicious processes)

3. **Prometheus** — All four tools expose metrics on standard HTTP endpoints scraped by `kube-prometheus-stack`

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Falco eBPF driver crashes under KVM/Cilium | HIDS non-functional | Fall back to `kmod` driver; if that fails, revisit with kernel header alignment or defer to Tetragon |
| Wazuh stack exceeds node memory | Node OOM, pod evictions | Pod affinity pins to server (32 GB); resource limits enforce ceiling; monitor actual usage and adjust |
| Suricata IDS generates excessive false positives | Alert fatigue | Start in IDS mode only; tune rules over 1-2 weeks before considering IPS |
| Trivy scan storms during peak hours | CPU/memory spikes on worker | Schedule daily scans during off-peak (03:00 PST); auto-scans on pod creation are lightweight per-image |
| Security namespace becomes single point of failure | Blindness to all security events | Critical alerts also route to Alertmanager independently; Wazuh has built-in clustering for future HA |

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

---

## References

- **Falco:** https://falco.org/docs/setup/kubernetes/ (Helm install guide, updated March 2026)
- **Suricata:** https://suricata.io/about/suricata-8/ (v8.0 release notes)
- **Wazuh:** https://documentation.wazuh.com/current/deployment-options/deploying-with-kubernetes/kubernetes-deployment.html
- **Morgoved Wazuh Helm Chart:** https://github.com/morgoved/wazuh-helm (tested with Wazuh 4.14.x)
- **Trivy Operator:** https://github.com/aquasecurity/trivy-operator (chart v0.34.x, July 2026)
- **ARMO OSS K8s Security Tools (Jan 2026):** https://www.armosec.io/blog/best-open-source-kubernetes-security-tools/
- **Cilium Falco→Tetragon Migration Guide (Jan 2026):** https://cilium.io/blog/2026/01/19/tetragon-falco-migrate/
