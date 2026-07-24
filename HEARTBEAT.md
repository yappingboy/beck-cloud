<!-- Heartbeat template; comments-only content prevents scheduled heartbeat API calls. -->

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## SRE Checks (rotate through, 2-3x/day)

### Cluster Health
- kubectl get nodes — all Ready?
- kubectl get pods --all-namespaces — any CrashLoopBackOff/Pending?
- kubectl top nodes — resource pressure?

### Storage
- df -h on hypervisor — disk pressure?
- kubectl get pv — any Pending/Released?
- Velero backup status — any failed backups in last 24h?

### Certificates
- cert-manager certificates expiring in < 30 days?

### Networking
- IngressRoutes responding (spot-check 3-4 key domains)?
- Traefik middleware chains healthy?

### Reporting
- All green → skip (no message)
- Anything yellow/red → alert Stephen with specifics

## Card Work (when no active agents)

- List workboard cards, skip done/running/blocked
- Check subagents list
- If no active subagents and there are ready/todo cards → spawn a sub-agent session to work the highest-priority card
- Spawned sub-agent prompt:
  "Claim the highest-priority ready/todo Workboard card. Read it, do the work, add proof, comment with progress, release the claim. If the card is complex, complete what you can and comment on what's remaining."
