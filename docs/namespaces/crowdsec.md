# crowdsec

**Purpose:** Security orchestration and WAF.

**What it does:** Runs the CrowdSec ecosystem: `crowdsec-lapi` (the daemon that coordinates agents and stores events), plus the agent and bouncer services. The bouncer middleware applies to all Traefik ingress routes. It checks IP reputation, enforces rate limiting, and bans offending IPs. This acts as a stateful WAF layer for the cluster.
