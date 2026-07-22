# silex

**Purpose:** Silex — BeckCloud's internal design and UI prototyping tool.

**What it does:** Silex is a web application used by admins to create UI mockups and prototypes. It runs as a container exposing an HTTP server (port 8080) and also provides an MCP (Model Context Protocol) endpoint on port 6807 for integration with other AI tools. The service stores project files and assets in persistent volumes.

**Resources:**
| Type | Details |
|------|---------|
| CPU | Unconstrained (none set) |
| RAM | 512Mi limit (no request) |
| PVCs | `silex-hosting` (4 GiB), `silex-root` (4 GiB) — both local-path for app data and hosting assets |

**Ports:**
- `8080` — Silex HTTP API / web UI.
- `6807` — MCP protocol for AI tool integration.

**Middleware / Ingress:**
- The service is internal-only; no public IngressRoute exists in the current config. If external access is ever needed, an IngressRoute would map a hostname to port 8080.

**Environment variables (Helm defaults):**
- `SILEX_PORT=8080`
- `MCP_PORT=6807`
- Database and file paths point to the PVC mounts.

**Notes:** Silex is not user-facing; it's a developer/admin tool for UI work.