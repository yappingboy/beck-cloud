# identity/email

**Purpose:** Outbound email relay for cluster services

**What it does:** Postfix outbound relay (accepts mail on port 25 from pods, sends through Mailgun smarthost). MariaDB StatefulSet provides the database backend.

**Services:**
- `postfix-relay` — Postfix ConfigMap + deployment
- `mariadb` — MariaDB StatefulSet + Service (in media namespace)
