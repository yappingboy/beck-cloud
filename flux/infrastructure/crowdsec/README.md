# crowdsec

**Purpose:** WAF + IP reputation protection

**What it does:** Deploys Crowdsec via HelmRelease, installs the Traefik Bouncer middleware (stream mode, global), and configures secret keys. Blocks banned IPs before they reach services.

**Special resources:** None.
