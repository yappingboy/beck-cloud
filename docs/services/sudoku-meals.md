# sudoku-meals

**Purpose:** Sudoku Meals — meal planner with 27 combo combinations.

**What it does:** Sudoku Meals is a small static site for meal planning. It renders a grid of meal combinations and lets the user track a week of meals. The service runs as a single Nginx container in the `webapps` namespace.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 10m request / 50m limit |
| RAM | 20Mi request / 64Mi limit |
| PVCs | None. All content is baked into the image. |

**Image:** `nginxinc/nginx-unprivileged:1.27-alpine`

**Ports:**
- `8080` — Static HTTP. Exposed by Traefik with TLS.

**Middleware / Ingress:**
- Route: `meals.becklab.cloud` → Service port 8080
- SSO: none (no middleware in the IngressRoute)

**Notes:** The site is a single-page app. It stores user selections in the browser, not on the server. The container is unprivileged Nginx.
