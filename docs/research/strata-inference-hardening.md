# Strata Provider Hardening (2026-11-10)

Nova's primary model (`strata/qwen3.8-flash-next-unsloth-ud-iq4_xs`, 94 GB, ~17 min cold load) is served from `172.16.0.21:8080` (k3s worker-1, TITAN RTX 24 GB + ~100 GB host RAM). This runbook covers the hardened architecture and the one remaining manual step.

## Architecture (post-hardening)

```
OpenClaw gateway (172.16.0.22)
  └─ http://172.16.0.21:8080/v1   (direct LAN, API-key)     ← primary path
  └─ strata-tunnel.service (systemd --user, enabled)        ← backup, only binds 127.0.0.1:8080 when free

172.16.0.21 (ubuntu)
  ├─ strata.service (systemd, enabled)                      ← ExecStart strata.py launch --no-tui, env key
  │     /etc/strata/env (0600 root) → STRATA_API_KEY        ← persistent key across restarts
  └─ strata-healthcheck.timer (2 min, active)               ← load-aware watchdog → restart strata.service
```

## Key locations

- Gateway: `~/.openclaw/openclaw.json → models.providers.strata` (hot-reload; direct LAN baseUrl)
- Gateway key mirror: `~/.openclaw/strata_key` (0600)
- Server key: `/etc/strata/env` on .21 (0600 root), consumed via `--api-key-env STRATA_API_KEY`
- ⚠️ Never embed the literal key in agent exec commands — the secret-masking layer rewrites `API_KEY=<value>` patterns in command text (silently wrote `***` once). Read it from the file/server instead.

## Operations

```bash
# health (no key needed)
curl -fsS -m5 http://172.16.0.21:8080/health

# status / restart (restart = ~17 min until /health ok)
ssh ubuntu@172.16.0.21 systemctl status strata
ssh ubuntu@172.16.0.21 sudo systemctl restart strata

# watchdog state
ssh ubuntu@172.16.0.21 systemctl list-timers | grep strata

# backup tunnel (only if direct path is down; stop manual tunnel first)
systemctl --user start strata-tunnel.service   # gateway host, then baseUrl → http://127.0.0.1:8080/v1
```

## PENDING: cutover of the live server

The *running* strata process is still the original interactive launch (terminal-attached, no restart-on-crash/boot until it moves). Watchdog makes failure self-healing (~20 min), but planned cutover is one restart:

1. Confirm quiet window with Stephen (~17–20 min Nova downtime).
2. `ssh ubuntu@172.16.0.21 sudo systemctl start strata` after killing the legacy process tree (strata.py launch pid → runtime → serve.server → engine).
3. Poll `/health` until `{"status":"ok"}`; verify a completion through the gateway.
4. `Ctrl-C` the legacy manual `ssh -L 8080…` tunnel on the gateway host (nothing depends on it now).

## Fallback notes

- `llama-cpp` provider configured (172.16.0.20:31000, store secret `SERVICE_API_KEY`) but the endpoint is down and .20 has no GPU. Not a usable fallback today.
- .21 ufw is inactive; 8080 is reachable from both LAN segments. Accepted: API-key protected. Optional: restrict 8080 to 172.16.0.22 only.
