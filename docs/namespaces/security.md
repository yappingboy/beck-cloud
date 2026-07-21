# security

**Purpose:** Secrets management and vulnerability scanning.

**What it does:** Hosts **Vaultwarden BSM** (`bw.becklab.cloud`), a Bitwarden-compatible self-hosted password manager with SSO enabled via the admin chain. Also runs **Trivy** (vulnerability scanner) as a mutating admission webhook and periodic image scanner, checking container images for CVEs before they're deployed. This namespace is the security gatekeeper for credentials and supply-chain risks.
