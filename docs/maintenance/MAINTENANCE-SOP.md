# Maintenance SOPs

**Last updated:** 2026-07-21  
**Scope:** Recurring maintenance tasks, rotation schedules, and operational procedures

---

## 1. Daily Checks

| Task | Command | Alert Condition |
|------|---------|----------------|
| Pod health | `kubectl get pods -A` | Any pod not in Running/Completed |
| Flux sync | `kubectl get kustomization -n flux-system` | Any with `Ready=False` |
| Certificate expiry | `kubectl get certificates -A` | Any expiring within 30 days |
| Velero backups | `kubectl get backups -n velero --sort-by=.metadata.creationTimestamp` | Any recent backup `Failed` |

---

## 2. Weekly Tasks

### Backup Verification

```bash
# Check most recent backups
kubectl get backups -n velero --sort-by=.metadata.creationTimestamp | head -10

# Verify backup contents (spot check)
velero describe backup <backup-name> --namespace velero
```

### Certificate Status

```bash
# Check all certificates
kubectl get certificates -A -o custom-columns='NAME:.metadata.name,NS:.metadata.namespace,READY:.status.conditions[0].status,EXPIRY:.status.renewalTime'
```

### Disk Usage

```bash
# Hypervisor
df -h /var/lib/one/datastores/101

# K3s worker
ssh k3s-worker-1 'df -h /mnt/media'
ssh k3s-worker-1 'df -h /'
```

---

## 3. Monthly Tasks

### SOPS Key Health Check

```bash
# Verify key is readable
age-keygen -y < secrets/homelab.agekey

# Check last rotation date
grep "Last rotated:" docs/ansible/SOPS-ROTATION.md
```

### HelmRelease Updates

```bash
# Check for available Helm chart updates
kubectl get helmrelease -A -o custom-columns='NAME:.metadata.name,NS:.metadata.namespace,REVISION:.status.lastAppliedRevision'

# Check HelmRepository sync status
kubectl get helmrepository -A
```

### Security Scan Review

```bash
# Trivy scan results
kubectl get trivyimagecache -A
kubectl get trivyconfigcache -A

# Wazuh alerts
# Check Wazuh dashboard for any high-severity alerts
```

---

## 4. Quarterly Tasks

### SOPS Key Rotation

Rotate the SOPS age keypair every 90 days or after any suspected compromise.

See [SOPS Rotation Guide](../ansible/SOPS-ROTATION.md).

### Documentation Audit

Review all documentation for accuracy:

1. Compare `docs/reference/` against live cluster state
2. Verify runbook procedures still work
3. Check namespace descriptions match current deployments
4. Update `Last audited:` dates

### Log Rotation

```bash
# Check K3s log sizes
du -sh /var/log/k3s* /var/log/pods/

# Truncate if excessive (>1GB)
truncate -s 0 /var/log/k3s-server.log
```

---

## 5. Annual Tasks

### Full Disaster Recovery Test

1. Document current state (take screenshots of key dashboards)
2. Provision a fresh VM
3. Run deployment runbook from scratch
4. Verify all services come up correctly
5. Compare against documented state
6. Update runbook with any discrepancies found

### Infrastructure Audit

1. Review all namespaces for unused services
2. Audit PVC usage and capacity planning
3. Review network policies
4. Audit RBAC roles and bindings
5. Review and update Ansible playbooks

---

## 6. Incident Response

### Pod CrashLoopBackOff

```bash
# Describe the pod
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace> --tail=100
kubectl logs <pod-name> -n <namespace> --previous --tail=100

# Check events
kubectl get events -n <namespace> --sort-by=.lastTimestamp
```

### Certificate Renewal Failure

```bash
# Check certificate order
kubectl get orders -A

# Check issuer
kubectl describe clusterissuer letsencrypt-production

# Check Let's Encrypt rate limits
# https://community.letsencrypt.org/
```

### Flux Sync Failure

```bash
# Check Flux controller logs
kubectl logs -n flux-system -l app=helm-controller --tail=100
kubectl logs -n flux-system -l app=kustomize-controller --tail=100

# Check specific kustomization
kubectl describe kustomization <name> -n flux-system
```

### Velero Backup Failure

```bash
# Check backup logs
velero backup describe <backup-name> --details
velero backup logs <backup-name>

# Check Velero pod
kubectl logs -n velero -l app.kubernetes.io/name=velero --tail=100
```
