# smtp-relay

**Purpose:** Postfix SMTP relay — delivers Keycloak notifications (password resets, user invites).

**What it does:** This lightweight Postfix instance runs in the `identity` namespace and forwards outgoing mail to the external SMTP provider configured by BeckCloud. It is triggered by the `user-invite` service and by Keycloak’s built-in email hooks. The relay only handles outbound traffic; no inbound mailboxes are exposed.

**Resources:**
| Type | Details |
|------|---------|
| CPU | 50m request / none set |
| RAM | 128Mi request / 256Mi limit |
| PVCs | None (ephemeral) |

**Ports:**
- `25` — SMTP (outbound only, used internally by the relay).
- `587` — Submission port (also outbound).

**Middleware / Ingress:**
- Internal service; not exposed externally. All mail is relayed to an upstream provider.

**Environment variables (Helm defaults):**
- `RELAY_HOST`, `RELAY_USER`, `RELAY_PASS` — credentials for the external SMTP server.
- `SMART_HOST` — points to the upstream relay.
- Other Postfix defaults (queue timeout, max connections, etc.).

**Notes:** Without this relay, Keycloak users would never receive password-reset or invite emails; it’s a small but critical piece of the SSO flow.