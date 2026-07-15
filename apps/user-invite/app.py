#!/usr/bin/env python3
"""
Becklab User Invite Tool v4
============================
Admin-only web app for inviting users to Becklab services.

Creates users in LLDAP via GraphQL API, sends invitation emails via SMTP relay.
Protected behind oauth2-proxy (admin group only).

Environment variables:
  LLDAP_URL            - LLDAP web URL
  LLDAP_ADMIN_USER     - Admin username for LLDAP API auth
  LLDAP_ADMIN_PASS     - Admin password for LLDAP API auth
  SMTP_HOST            - SMTP relay host
  SMTP_PORT            - SMTP port (default: 25)
  FROM_EMAIL           - Sender address
  KEYCLOAK_URL         - Keycloak internal URL
  KEYCLOAK_EXTERNAL_URL - Keycloak external URL (for invite emails)
  KEYCLOAK_ADMIN_USER  - Keycloak admin username
  KEYCLOAK_ADMIN_PASS  - Keycloak admin password
  FLASK_SECRET_KEY     - Flask session secret
  EMAIL_TEMPLATE       - Optional custom email HTML template (Jinja2).
                         If set, overrides the default. Use {{username}},
                         {{password}}, {{groups}}, {{account_url}} placeholders.

Features:
  - Dashboard lists all current users from LLDAP
  - Invite form with Username, Email, Firstname, Lastname, Groups checkboxes
  - Configurable email template via EMAIL_TEMPLATE env var
"""

import os
import re
import smtplib
import secrets
import string

from flask import Flask, request, redirect, url_for, flash, render_template_string
import requests as http_requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
LLDAP_URL = os.environ.get("LLDAP_URL", "http://lldap.identity.svc.cluster.local:17170")
LLDAP_ADMIN_USER = os.environ.get("LLDAP_ADMIN_USER", "admin")
LLDAP_ADMIN_PASS = os.environ.get("LLDAP_ADMIN_PASS", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp-relay.email.svc.cluster.local")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "25"))
FROM_EMAIL = os.environ.get("FROM_EMAIL", "invites@becklab.cloud")
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://keycloak.identity.svc.cluster.local:8080")
KEYCLOAK_EXTERNAL_URL = os.environ.get(
    "KEYCLOAK_EXTERNAL_URL",
    "https://keycloak.becklab.cloud",
)
KEYCLOAK_ADMIN_USER = os.environ.get("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASS = os.environ.get("KEYCLOAK_ADMIN_PASS", "")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "homelab")

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))


# ---------------------------------------------------------------------------
# LLDAP API
# ---------------------------------------------------------------------------
def get_jwt():
    resp = http_requests.post(
        f"{LLDAP_URL}/auth/simple/login",
        json={"username": LLDAP_ADMIN_USER, "password": LLDAP_ADMIN_PASS},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def gql(query, variables=None):
    token = get_jwt()
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = http_requests.post(
        f"{LLDAP_URL}/api/graphql",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise Exception(f"GraphQL error: {data['errors']}")
    return data["data"]


def fetch_groups():
    return gql("{ groups { id displayName } }").get("groups", [])


def fetch_users():
    """Fetch all users with their group memberships."""
    raw = gql(
        "{ users { id email displayName firstName lastName groups { id displayName } } }"
    )
    return raw.get("users", [])


def create_user(username, email, first_name, last_name):
    display_name = f"{first_name} {last_name}".strip() if (first_name and last_name) else username
    gql(
        "mutation CreateUser($user: CreateUserInput!) { createUser(user: $user) { id email displayName } }",
        {
            "user": {
                "id": username,
                "email": email or None,
                "displayName": display_name,
                "firstName": first_name or "",
                "lastName": last_name or "",
            }
        },
    )


def add_to_group(username, group_id):
    gql(
        "mutation AddUserToGroup($userId: String!, $groupId: Int!) { addUserToGroup(userId: $userId, groupId: $groupId) { ok } }",
        {"userId": username, "groupId": int(group_id)},
    )


# ---------------------------------------------------------------------------
# Keycloak Admin API
# ---------------------------------------------------------------------------
def get_kc_admin_token():
    """Get a Keycloak admin token via the master realm."""
    resp = http_requests.post(
        f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": KEYCLOAK_ADMIN_USER,
            "password": KEYCLOAK_ADMIN_PASS,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def kc_api(path, method="GET", json=None, params=None):
    """Make an authenticated Keycloak Admin API call."""
    token = get_kc_admin_token()
    url = f"{KEYCLOAK_URL}/admin{path}"
    resp = http_requests.request(
        method,
        url,
        json=json,
        params=params,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    if resp.status_code not in (200, 201, 204):
        raise Exception(f"Keycloak API {method} {path} returned {resp.status_code}: {resp.text}")
    return resp


def find_kc_user(username):
    """Find a user in the target realm by username."""
    r = kc_api(f"/realms/{KEYCLOAK_REALM}/users", params={"username": username, "exact": True})
    if r.status_code == 204 or (r.text.strip() and r.text.strip() != "[]"):
        users = r.json()
        if users:
            return users[0]
    return None


def create_kc_user(username, email="", first_name="", last_name=""):
    """Create a user in Keycloak."""
    payload = {
        "username": username,
        "email": email,
        "enabled": True,
        "emailVerified": False,
        "firstName": first_name or username.capitalize(),
        "lastName": last_name or "User",
        "credentials": [],
    }
    r = kc_api(f"/realms/{KEYCLOAK_REALM}/users", method="POST", json=payload)
    location = r.headers.get("Location", "")
    user_id = location.split("/")[-1] if location else None
    return {"id": user_id, "username": username}


def set_password(username, password, first_name="", last_name=""):
    """Set a user's initial password in Keycloak.

    Finds or creates the user, ensures firstName/lastName are set,
    then sets a temporary password credential.
    """
    user = find_kc_user(username)

    if not user:
        try:
            user = create_kc_user(username, "", first_name, last_name)
        except Exception as e:
            raise Exception(f"Failed to create user in Keycloak: {e}")

    user_id = user["id"]

    # Ensure firstName/lastName are set — LDAP-synced users may be missing these,
    # and Keycloak requires both for login to work
    needs_update = False
    update_payload = {}
    if not user.get("firstName"):
        update_payload["firstName"] = first_name or username.capitalize()
        needs_update = True
    if not user.get("lastName"):
        update_payload["lastName"] = last_name or "User"
        needs_update = True

    if needs_update:
        kc_api(
            f"/realms/{KEYCLOAK_REALM}/users/{user_id}",
            method="PUT",
            json=update_payload,
        )

    cred_path = f"/realms/{KEYCLOAK_REALM}/users/{user_id}/reset-password"
    kc_api(
        cred_path,
        method="PUT",
        json={
            "type": "password",
            "value": password,
        },
    )


# ---------------------------------------------------------------------------
# Email — configurable template
# ---------------------------------------------------------------------------

# Default email HTML template (used when EMAIL_TEMPLATE is not set)
DEFAULT_EMAIL_HTML = """\
<!doctype html>
<html><head><meta charset="utf-8"><title>Welcome to Becklab</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px 20px}
.c{max-width:560px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px}
h1{color:#38bdf8;margin-top:0}.creds{background:#0f172a;border-radius:8px;padding:16px;margin:20px 0;font-family:monospace;white-space:pre-line}
a{color:#38bdf8;text-decoration:none}a:hover{text-decoration:underline}
.btn{display:inline-block;background:#38bdf8;color:#0f172a;padding:12px 24px;border-radius:6px;font-weight:bold;margin-top:16px}
</style></head><body>
<div class="c">
<h1>Welcome to Becklab! ⚡</h1>
<p>You've been invited to join the Becklab services.</p>
<div class="creds"><strong>Username:</strong> {{username}}<br><strong>Password:</strong> {{password}}</div>
{% if groups %}<p><strong>Groups:</strong> {{groups}}</p>{% endif %}
<a class="btn" href="{{account_url}}">Go to Account Settings →</a>
<p style="margin-top:16px;font-size:.85em;color:#94a3b8">Log in and update your password right away.</p>
<hr style="border-color:#334155;margin:24px 0">
<p style="font-size:.8em;color:#64748b">Automated invitation from Becklab admin. Ignore if unexpected.</p>
</div></body></html>"""

DEFAULT_EMAIL_TEXT = """\
Welcome to Becklab! ⚡

You've been invited to join the Becklab services.

  Username: {{username}}
  Password: {{password}}

{% if groups %}Groups: {{groups}}{% endif %}

Log in here and update your password:
{{account_url}}

---
Automated invitation from Becklab admin. Ignore if unexpected.
"""


def render_email_template(template_str, username, password, groups, account_url):
    """Render an email template string with Jinja2 placeholders."""
    return render_template_string(
        template_str,
        username=username,
        password=password,
        groups=groups,
        account_url=account_url,
    )


def send_invite(email, username, password, group_names):
    groups_str = ", ".join(group_names) if group_names else ""
    account_url = f"{KEYCLOAK_EXTERNAL_URL}/realms/homelab/account"

    # Use custom template from env var, or fall back to default
    custom_html = os.environ.get("EMAIL_TEMPLATE", "").strip()
    html_template = custom_html if custom_html else DEFAULT_EMAIL_HTML
    text_template = DEFAULT_EMAIL_TEXT  # Plain-text fallback stays static

    html = render_email_template(html_template, username, password, groups_str, account_url)
    text = render_email_template(text_template, username, password, groups_str, account_url)

    msg = (
        f"From: Becklab Invites <{FROM_EMAIL}>\r\n"
        f"To: {email}\r\n"
        f"Subject: Welcome to Becklab — Your Invitation\r\n"
        f"MIME-Version: 1.0\r\n"
        f"Content-Type: multipart/alternative; boundary=\"b1\"\r\n"
        f"\r\n--b1\r\n"
        f"Content-Type: text/plain; charset=utf-8\r\n"
        f"Content-Transfer-Encoding: 7bit\r\n"
        f"\r\n{text}\r\n"
        f"--b1\r\n"
        f"Content-Type: text/html; charset=utf-8\r\n"
        f"Content-Transfer-Encoding: 7bit\r\n"
        f"\r\n{html}\r\n"
        f"--b1--\r\n"
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.sendmail(FROM_EMAIL, email, msg.encode("utf-8"))


# ---------------------------------------------------------------------------
# Web Templates
# ---------------------------------------------------------------------------
LAYOUT = """\
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ title }} — Becklab</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{max-width:640px;width:100%;background:#1e293b;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.3)}
h1{color:#38bdf8;margin-bottom:8px;font-size:1.5em}
.sub{color:#94a3b8;font-size:.9em;margin-bottom:24px}
label.lbl{display:block;color:#94a3b8;font-size:.85em;margin-bottom:4px;margin-top:16px}
input[type=text],input[type=email]{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:1em}
input:focus{outline:none;border-color:#38bdf8}
.cbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.cb{background:#0f172a;border:1px solid #334155;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:.9em;display:flex;align-items:center;gap:6px}
.cb input{accent-color:#38bdf8}
.btn{background:#38bdf8;color:#0f172a;border:none;padding:12px 24px;border-radius:6px;font-size:1em;font-weight:bold;cursor:pointer;margin-top:24px;width:100%}
.btn:hover{background:#7dd3fc}
.err{background:#7f1d1d;color:#fecaca;padding:12px;border-radius:6px;margin-top:16px;font-size:.9em}
.ok{background:#14532d;color:#bbf7d0;padding:12px;border-radius:6px;margin-top:16px;font-size:.9em}
.link{display:inline-block;margin-top:16px;color:#38bdf8;text-decoration:none;font-size:.9em}

/* User table styles */
.user-table{width:100%;border-collapse:collapse;margin-top:16px;font-size:.9em}
.user-table th{text-align:left;padding:8px 12px;border-bottom:2px solid #334155;color:#38bdf8;font-weight:600}
.user-table td{padding:8px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1}
.user-table tr:hover td{background:#0f172a}
.badge{display:inline-block;background:#0f172a;border:1px solid #334155;border-radius:4px;padding:2px 8px;font-size:.8em;margin-right:4px;color:#94a3b8}
.no-users{text-align:center;color:#64748b;padding:24px;font-style:italic}
.section{margin-top:24px;padding-top:24px;border-top:1px solid #334155}
</style>
</head><body>
<div class="card">
{% with msgs = get_flashed_messages(with_categories=true) %}
{% for cat, msg in msgs %}<div class="{{ cat }}">{{ msg }}</div>{% endfor %}{% endwith %}
{{ content | safe }}
</div></body></html>"""

DASHBOARD_CONTENT = """\
<h1>⚡ Becklab Admin</h1>
<p class="sub">Manage user invitations.</p>
<a href="/invite" style="display:block;text-align:center;background:#38bdf8;color:#0f172a;padding:14px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px">+ Invite New User</a>

<div class="section">
<h2 style="color:#38bdf8;font-size:1.1em;margin-bottom:8px">Current Users ({{ users|length }})</h2>
{% if users %}
<table class="user-table">
<thead><tr><th>User</th><th>Email</th><th>Name</th><th>Groups</th></tr></thead>
<tbody>
{% for u in users %}
<tr>
  <td>{{ u.id }}</td>
  <td>{{ u.email or '—' }}</td>
  <td>{% if u.firstName and u.lastName %}{{ u.firstName }} {{ u.lastName }}{% elif u.displayName %}{{ u.displayName }}{% else %}—{% endif %}</td>
  <td>{% for g in (u.groups or []) %}<span class="badge">{{ g.displayName }}</span>{% endfor %}{% if not (u.groups or []) %}—{% endif %}</td>
</tr>
{% endfor %}
</tbody>
</table>
{% else %}
<p class="no-users">No users found.</p>
{% endif %}
</div>
"""

INVITE_FORM_CONTENT = """\
<h1>⚡ Invite a User</h1>
<p class="sub">Create an account and send an invitation email.</p>
<form method="POST" action="/invite">
  <label class="lbl" for="username">Username</label>
  <input type="text" id="username" name="username" required autocomplete="off" placeholder="jdoe">

  <label class="lbl" for="email">Email Address</label>
  <input type="email" id="email" name="email" required placeholder="jdoe@example.com">

  <label class="lbl" for="first_name">First Name *</label>
  <input type="text" id="first_name" name="first_name" required placeholder="Jane">

  <label class="lbl" for="last_name">Last Name *</label>
  <input type="text" id="last_name" name="last_name" required placeholder="Doe">

  <label class="lbl">Groups</label>
  <div class="cbs">
    {% for g in groups %}
    <label class="cb"><input type="checkbox" name="groups" value="{{ g.id }}"> {{ g.displayName }}</label>
    {% endfor %}
  </div>

  <button class="btn" type="submit">Send Invitation</button>
</form>
<a class="link" href="/">← Back to dashboard</a>
"""

SUCCESS_CONTENT = """\
<h1>✅ Invitation Sent!</h1>
<p class="sub">The user has been created and an email sent.</p>
<a class="link" href="/invite">+ Invite another user</a><br>
<a class="link" href="/">← Back to dashboard</a>
"""


def render(title, content_html):
    return render_template_string(LAYOUT, title=title, content=content_html)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def dashboard():
    try:
        users = fetch_users()
    except Exception as e:
        flash(f"Could not load user list: {e}", "err")
        users = []
    content = render_template_string(DASHBOARD_CONTENT, users=users)
    return render("Dashboard", content)


@app.route("/invite", methods=["GET"])
def invite_get():
    all_groups = fetch_groups()
    content = render_template_string(INVITE_FORM_CONTENT, groups=all_groups)
    return render("Invite User", content)


@app.route("/invite", methods=["POST"])
def invite_post():
    username = request.form.get("username", "").strip().lower()
    email = request.form.get("email", "").strip().lower()
    first_name = request.form.get("first_name", "").strip()
    last_name = request.form.get("last_name", "").strip()
    selected_gids = request.form.getlist("groups")

    if not username or not email:
        flash("Username and email are required.", "err")
        return redirect(url_for("invite_get"))

    if not first_name:
        flash("First name is required.", "err")
        return redirect(url_for("invite_get"))

    if not last_name:
        flash("Last name is required.", "err")
        return redirect(url_for("invite_get"))

    if not re.match(r"^[a-z0-9][a-z0-9._-]{1,38}$", username):
        flash("Username: 2–40 chars, lowercase letters/numbers/dots/hyphens/underscores.", "err")
        return redirect(url_for("invite_get"))

    display_name = f"{first_name} {last_name}"

    # Generate password
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    temp_pass = "".join(secrets.choice(alphabet) for _ in range(16))

    try:
        create_user(username, email, first_name, last_name)
    except Exception as e:
        msg = str(e).lower()
        if "already" in msg or "duplicate" in msg or "exists" in msg:
            flash(f"User '{username}' already exists.", "err")
        else:
            flash(f"Failed to create user: {e}", "err")
        return redirect(url_for("invite_get"))

    try:
        set_password(username, temp_pass, first_name, last_name)
    except Exception as e:
        flash(f"User created but password setting failed: {e}. Fix manually.", "err")
        return redirect("/")

    group_names = []
    all_groups = fetch_groups()
    for gid in selected_gids:
        try:
            add_to_group(username, gid)
            gobj = next((g for g in all_groups if str(g["id"]) == str(gid)), None)
            if gobj:
                group_names.append(gobj["displayName"])
        except Exception as e:
            flash(f"Warning: could not add to a group ({e}).", "err")

    try:
        send_invite(email, username, temp_pass, group_names)
    except Exception as e:
        flash(f"User created but email failed: {e}. Manually share credentials.", "err")
        return redirect("/")

    flash(f"Invitation sent to {email} for user '{username}'.", "ok")
    content = render_template_string(SUCCESS_CONTENT)
    return render("Sent!", content)


@app.route("/health")
def health():
    return {"status": "ok"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
