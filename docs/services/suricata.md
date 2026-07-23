# suricata

**Purpose:** Intrusion Detection/Prevention System (IDS/IPS) for network traffic analysis.

**What it does:** Suricata (v8.0.6) inspects live network traffic on each cluster node for known threats, anomalies, and policy violations. It runs as a DaemonSet so every node has a local instance capturing traffic on the `cilium_host` interface. Rules are loaded from a ConfigMap and can be updated without redeploying. Detection events are written to `eve.json` and forwarded to Wazuh for alerting and log aggregation.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 100m request / 1 limit (Suricata container) |
| RAM | 256Mi request / 2Gi limit (Suricata container) |
| CPU | 10m request / 50m limit (log-forwarder container) |
| RAM | 32Mi request / 64Mi limit (log-forwarder container) |
| Volumes | `emptyDir` for config staging and log sharing (no PVCs) |

**Ports:**
- No exposed ports. Suricata operates passively on the host network interface.

**Deployment topology:**
- **Type:** DaemonSet — runs one pod per node (2 nodes, 2 pods).
- **Node selector:** None (runs on all nodes).
- **Tolerations:** `op=Exists` (tolerates all taints).

**Containers:**
- **suricata** (`jasonish/suricata:8.0.6-amd64`) — Main engine, runs with `-i cilium_host` to capture traffic from the Cilium host interface.
- **log-forwarder** (`alpine:3.20`) — Sidecar that tails `/var/log/suricata/eve.json` and streams each line via `nc` to `wazuh-manager-worker.security.svc.cluster.local:514` (syslog). Retries with a 2-second backoff on connection failure.
- **copy-config** (init, `busybox:latest`) — Copies `suricata.yaml` from the `suricata-config` ConfigMap into an `emptyDir` volume so the main container can mount it.

**Configuration:**
- **suricata-config ConfigMap** — Contains `suricata.yaml` (main engine config) and rule files. Mounted read-only as `config-src`, then copied by the init container.
- **suricata-rules ConfigMap** — Contains Suricata detection rules (signature definitions).
- Config and rules are decoupled so rules can be updated independently of the engine configuration.

**Log flow:**
```
cilium_host traffic → Suricata engine → eve.json (emptyDir) → log-forwarder sidecar → nc → wazuh-manager-worker:514 (syslog)
```

**Notes:** Suricata runs on every node to ensure no traffic is missed. The DaemonSet with `tolerations: op=Exists` guarantees pods schedule even on tainted nodes. Rule updates only require updating the ConfigMap and restarting the DaemonSet.
