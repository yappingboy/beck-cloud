# crowdsec

**Purpose:** Security orchestration and WAF.

**What it does:** Runs the CrowdSec ecosystem: `crowdsec-lapi` (the LAPI daemon that coordinates agents and stores events), plus the agent service and bouncer service. The bouncer middleware is applied globally to all Traefik ingress routes, intercepting incoming HTTP traffic before it reaches any application. It checks IP reputation against shared crowdsec databases, enforces rate limiting, and can ban offending IPs — effectively acting as a stateful WAF layer for the entire cluster.
