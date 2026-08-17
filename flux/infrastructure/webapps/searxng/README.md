# SearXNG

Self-hosted metasearch engine. Private instance behind admin SSO + Crowdsec.

- **Domain:** `searx.becklab.cloud`
- **Image:** `docker.io/searxng/searxng:latest` (GHCR mirror: `ghcr.io/searxng/searxng` — use if DockerHub rate limits bite)
- **Limiter:** enabled, backed by `searxng-valkey` (ephemeral `emptyDir` data)
- **Secrets:** `searxng-secrets` (SOPS) — `secret-key` (CSRF/session), `open-metrics-password` (Prometheus /metrics Basic Auth)
- **Config:** `searxng-config` ConfigMap → `/etc/searxng` (settings.yml + limiter.toml)

## Notes

- `trusted_proxies` in `limiter.toml` is commented out. Set it to the Cilium pod CIDR(s) if you hit false-positive bot blocks. Get CIDRs with: `cilium status` or `kubectl get configmap -n kube-system` / cluster CIDR from the K3s server.
- Upstream docs: https://docs.searxng.org/admin/installation-docker.html
- Limiter docs: https://docs.searxng.org/admin/searx.limiter.html
- `/metrics` is OpenMetrics behind HTTP Basic Auth (any username, password = `open-metrics-password`).
