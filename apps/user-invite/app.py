#!/usr/bin/env python3
"""
Becklab User Invite Tool
========================
Admin-only web app for inviting users to Becklab services.

Creates users in LLDAP via GraphQL API, sends invitation emails via SMTP relay.
Protected behind oauth2-proxy (admin group only).

Environment variables:
  LLDAP_URL          - LLDAP web URL
  LLDAP_ADMIN_USER   - Admin username for LLDAP API auth
  LLDAP_ADMIN_PASS   - Admin password for LLDAP API auth
  SMTP_HOST          - SMTP relay host
  SMTP_PORT          - SMTP port (default: 25)
  FROM_EMAIL         - Sender address
  KEYCLOAK_URL       - Keycloak login URL for invite emails
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
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "https://keycloak.becklab.cloud")


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


def create_user(username, email, display_name):
    gql(
        "mutation CreateUser($user: CreateUserInput!) { createUser(user: $user) { id email displayName } }",
        {"user": {"id": username, "email": email or None, "displayName": display_name or username}},
    )


def add_to_group(username, group_id):
    gql(
        "mutation AddUserToGroup($userId: String!, $groupId: Int!) { addUserToGroup(userId: $userId, groupId: $groupId) { ok } }",
        {"userId": username, "groupId": int(group_id)},
    )


def set_password(username, password):
    """Set a user's password in LLDAP.

    Uses the updateUser mutation with userPassword attribute insertion.
    This works because the admin JWT has full privileges.
    """
    token = get_jwt()
    resp = http_requests.post(
        f"{LLDAP_URL}/api/graphql",
        json={
            "query": """
                mutation SetPass($id: String!, $pass: [String!]!) {
                    updateUser(user: { id: $id, insertAttributes: [{name: "userPassword", value: $pass}] }) { ok }
                }
            """,
            "variables": {"id": username, "pass": [password]},
        },
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise Exception(f"setPassword GraphQL error: {data['errors']}")
    result = data["data"]["updateUser"]
    if not result.get("ok"):
        raise Exception("setPassword returned ok=false")


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
def send_invite(email, username, password, group_names):
    groups_str = ", ".join(group_names) if group_names else "none"
    account_url = f"{KEYCLOAK_URL}/realms/homelab/account"

    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Welcome to Becklab</title>
<style>
body{{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:40px 20px}}
.c{{max-width:560px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px}}
h1{{color:#38bdf8;margin-top:0}}.creds{{background:#0f172a;border-radius:8px;padding:16px;margin:20px 0;font-family:monospace;white-space:pre-line}}
a{{color:#38bdf8;text-decoration:none}}a:hover{{text-decoration:underline}}
.btn{{display:inline-block;background:#38bdf8;color:#0f172a;padding:12px 24px;border-radius:6px;font-weight:bold;margin-top:16px}}
</style></head><body>
<div class="c">
<h1>Welcome to Becklab! ⚡</h1>
<p>You've been invited to join the Becklab services.</p>
<div class="creds"><strong>Username:</strong> {username}<br><strong>Password:</strong> {password}</div>
<p><strong>Groups:</strong> {groups_str}</p>
<a class="btn" href="{account_url}">Go to Account Settings →</a>
<p style="margin-top:16px;font-size:.85em;color:#94a3b8">Log in and update your password right away.</p>
<hr style="border-color:#334155;margin:24px 0">
<p style="font-size:.8em;color:#64748b">Automated invitation from Becklab admin. Ignore if unexpected.</p>
</div></body></html>"""

    text = f"""\
Welcome to Becklab! ⚡

You've been invited to join the Becklab services.

  Username: {username}
  Password: {password}

Groups: {groups_str}

Log in here and update your password:
{account_url}

---
Automated invitation from Becklab admin. Ignore if unexpected.
"""

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
# Templates (embedded to avoid ConfigMap complexity)
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
.card{max-width:560px;width:100%;background:#1e293b;border-radius:12px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.3)}
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
"""

INVITE_FORM_CONTENT = """\
<h1>⚡ Invite a User</h1>
<p class="sub">Create an account and send an invitation email.</p>
<form method="POST" action="/invite">
  <label class="lbl" for="username">Username</label>
  <input type="text" id="username" name="username" required autocomplete="off" placeholder="jdoe">

  <label class="lbl" for="email">Email Address</label>
  <input type="email" id="email" name="email" required placeholder="jdoe@example.com">

  <label class="lbl" for="display_name">Full Name (optional)</label>
  <input type="text" id="display_name" name="display_name" placeholder="Jane Doe">

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
    username = request.headers.get("X-Auth-Request-User", "Guest")
    return render("Dashboard", DASHBOARD_CONTENT)


@app.route("/invite", methods=["GET"])
def invite_get():
    all_groups = fetch_groups()
    content = render_template_string(INVITE_FORM_CONTENT, groups=all_groups)
    return render("Invite User", content)


@app.route("/invite", methods=["POST"])
def invite_post():
    username = request.form.get("username", "").strip().lower()
    email = request.form.get("email", "").strip().lower()
    display_name = request.form.get("display_name", "").strip()
    selected_gids = request.form.getlist("groups")

    if not username or not email:
        flash("Username and email are required.", "err")
        return redirect(url_for("invite_get"))

    if not re.match(r"^[a-z0-9][a-z0-9._-]{1,38}$", username):
        flash("Username: 2–40 chars, lowercase letters/numbers/dots/hyphens/underscores.", "err")
        return redirect(url_for("invite_get"))

    # Generate password
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    temp_pass = "".join(secrets.choice(alphabet) for _ in range(16))

    try:
        create_user(username, email, display_name or username)
    except Exception as e:
        msg = str(e).lower()
        if "already" in msg or "duplicate" in msg or "exists" in msg:
            flash(f"User '{username}' already exists.", "err")
        else:
            flash(f"Failed to create user: {e}", "err")
        return redirect(url_for("invite_get"))

    try:
        set_password(username, temp_pass)
    except Exception as e:
        flash(f"User created but password setting failed: {e}. Fix manually in LLDAP.", "err")
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
