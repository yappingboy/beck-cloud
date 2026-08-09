#!/usr/bin/env node
/**
 * BeckCloud Landing Page — Express API Gateway
 *
 * Serves the landing page, admin portal, user profile portal,
 * and provides the REST API backend that powers both portals.
 *
 * Architecture:
 *   Client (browser) → Express (this server) → [Keycloak | LLDAP | Directus | Prometheus]
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak.identity.svc.cluster.local:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'homelab';
const KEYCLOAK_ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'suCNJ5CtDdHEdy3Zhy6azwgG';
const LLDAP_URL = process.env.LLDAP_URL || 'http://lldap.identity.svc.cluster.local:17170';
const LLDAP_ADMIN_USERNAME = process.env.LLDAP_ADMIN_USERNAME || 'admin';
const LLDAP_ADMIN_PASSWORD = process.env.LLDAP_ADMIN_PASSWORD || '0VFdWI9LXWugx8H0LpV5hePG';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://directus.cms.svc.cluster.local:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus.monitoring.svc.cluster.local:9090';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis.identity.svc.cluster.local:6379';
const SESSION_SECRET = process.env.SESSION_SECRET || 'beckcloud-session-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'beckcloud-jwt-secret';

const STATIC_ROOT = path.join(__dirname, '..', '..', 'docs', 'brand', 'website');

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (stores in Redis in production, memory in dev)
let sessionStore;
let RedisClient;
let redis;

try {
  sessionStore = require('connect-redis').default;
  RedisClient = require('ioredis').default;
  redis = new RedisClient(REDIS_URL);
  redis.on('error', (err) => console.error('Redis connection error:', err.message));
} catch (err) {
  console.warn('Redis not available, using memory store');
}

const sessionOptions = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  name: 'beckcloud.sid',
};

if (sessionStore && redis) {
  sessionOptions.store = new sessionStore({ client: redis });
}

app.use(session(sessionOptions));

// ---------------------------------------------------------------------------
// Static Assets — serve from docs/brand/website/
// ---------------------------------------------------------------------------
app.use('/static', express.static(STATIC_ROOT));
app.use('/css', express.static(path.join(STATIC_ROOT, 'css')));
app.use('/js', express.static(path.join(STATIC_ROOT, 'js')));
app.use('/favicon.svg', express.static(path.join(STATIC_ROOT, 'favicon.svg')));
app.use('/robots.txt', express.static(path.join(STATIC_ROOT, 'robots.txt')));

// ---------------------------------------------------------------------------
// Serve Pages
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'index.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'portal.html'));
});

app.get('/portal.html', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'portal.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'admin', 'index.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'admin', 'index.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'profile', 'profile.html'));
});

app.get('/profile/', (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, 'profile', 'profile.html'));
});

// ---------------------------------------------------------------------------
// Keycloak Admin Auth Helper
// ---------------------------------------------------------------------------
async function getKeycloakAdminToken() {
  const resp = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: KEYCLOAK_ADMIN_CLIENT_ID,
      username: KEYCLOAK_ADMIN_USERNAME,
      password: KEYCLOAK_ADMIN_PASSWORD,
    }),
  });

  if (!resp.ok) throw new Error(`Keycloak auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function keycloakAdminAPI(path, method = 'GET', json = null) {
  const token = await getKeycloakAdminToken();
  const resp = await fetch(`${KEYCLOAK_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: json ? JSON.stringify(json) : undefined,
  });

  if (!resp.ok) throw new Error(`Keycloak API ${method} ${path} failed: ${resp.status}`);
  if (resp.status === 204) return null;
  return resp.json();
}

// ---------------------------------------------------------------------------
// LLDAP Helper
// ---------------------------------------------------------------------------
async function getLLDAPToken() {
  const resp = await fetch(`${LLDAP_URL}/auth/simple/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: LLDAP_ADMIN_USERNAME,
      password: LLDAP_ADMIN_PASSWORD,
    }),
  });

  if (!resp.ok) throw new Error(`LLDAP auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.token;
}

async function lldapGQL(query, variables = {}) {
  const token = await getLLDAPToken();
  const resp = await fetch(`${LLDAP_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) throw new Error(`LLDAP GraphQL failed: ${resp.status}`);
  const data = await resp.json();
  if (data.errors) throw new Error(`LLDAP errors: ${JSON.stringify(data.errors)}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Prometheus Helper
// ---------------------------------------------------------------------------
async function prometheusQuery(query) {
  const resp = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error(`Prometheus query failed: ${resp.status}`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Auth Middleware
// ---------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const roles = req.session.user.realm_access?.roles || [];
  if (!roles.includes('beckcloud.admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ---------------------------------------------------------------------------
// API Routes — Auth
// ---------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    // Authenticate against Keycloak
    const resp = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'beckcloud-web',
        username,
        password,
      }),
    });

    if (!resp.ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const data = await resp.json();

    // Fetch user details and realm access
    const userResp = await fetch(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${await getKeycloakAdminToken()}` },
    });
    const users = await userResp.json();

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      realm_access: user.realm_access || { roles: [] },
      resource_access: user.resource_access || {},
    };

    res.json({
      status: 'success',
      result: {
        token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ status: 'success' });
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ status: 'success', result: req.session.user });
});

// ---------------------------------------------------------------------------
// API Routes — Users
// ---------------------------------------------------------------------------
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // Fetch from LLDAP (source of truth)
    const data = await lldapGQL(
      '{ users { id email displayName firstName lastName groups { id displayName } createdAt } }'
    );
    res.json({ status: 'success', result: data.users || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, email, firstName, lastName, password, groups } = req.body;

    // Create in LLDAP
    await lldapGQL(
      `mutation CreateUser($user: CreateUserInput!) {
        createUser(user: $user) { id email displayName }
      }`,
      { user: { id: username, email, displayName: `${firstName} ${lastName}`.trim(), firstName, lastName } }
    );

    // Set password in Keycloak
    const kcUsers = await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`);
    if (kcUsers && kcUsers.length === 0) {
      // Create in Keycloak
      await keycloakAdminAPI(
        `/admin/realms/${KEYCLOAK_REALM}/users`,
        'POST',
        { username, email, enabled: true, emailVerified: false, firstName, lastName, credentials: [{ type: 'password', value: password }] }
      );
    }

    // Add to groups
    if (groups) {
      const allGroups = await lldapGQL('{ groups { id displayName } }');
      for (const groupId of groups) {
        await lldapGQL(
          `mutation AddUserToGroup($userId: String!, $groupId: Int!) {
            addUserToGroup(userId: $userId, groupId: $groupId) { ok }
          }`,
          { userId: username, groupId: parseInt(groupId) }
        );
      }
    }

    res.status(201).json({ status: 'success', result: { username, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:username', requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, groups, enabled } = req.body;
    // Update LLDAP user
    await lldapGQL(
      `mutation UpdateUser($user: UpdateUserInput!) {
        updateUser(user: $user) { id email displayName }
      }`,
      { user: { id: req.params.username, email, firstName, lastName } }
    );
    res.json({ status: 'success', result: req.params.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:username', requireAdmin, async (req, res) => {
  try {
    await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users`, 'DELETE', { username: req.params.username });
    res.json({ status: 'success', result: req.params.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Keycloak Users (for admin panel)
// ---------------------------------------------------------------------------
app.get('/api/users/keycloak', requireAdmin, async (req, res) => {
  try {
    const kcUsers = await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users`);
    // Enrich with Keycloak-specific data
    const enriched = [];
    for (const user of (kcUsers || [])) {
      const rolesResp = await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users/${user.id}/role-mappings/realm`);
      const roles = (rolesResp || []).map(r => r.name);
      enriched.push({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        roles,
        lastLogin: user.lastLogin,
      });
    }
    res.json({ status: 'success', result: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Groups
// ---------------------------------------------------------------------------
app.get('/api/groups', requireAdmin, async (req, res) => {
  try {
    const data = await lldapGQL('{ groups { id displayName description memberCount createdAt } }');
    res.json({ status: 'success', result: data.groups || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    await lldapGQL(
      `mutation CreateGroup($group: CreateGroupInput!) {
        createGroup(group: $group) { id displayName }
      }`,
      { group: { id: name.toLowerCase().replace(/\s+/g, '-'), displayName: name, description } }
    );
    res.status(201).json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Service Health
// ---------------------------------------------------------------------------
app.get('/api/health/services', requireAdmin, async (req, res) => {
  try {
    const services = [
      { name: 'Keycloak', url: KEYCLOAK_URL, path: '/admin/realms/homelab' },
      { name: 'LLDAP', url: LLDAP_URL, path: '/api/users' },
      { name: 'Directus', url: DIRECTUS_URL, path: '/health' },
      { name: 'Prometheus', url: PROMETHEUS_URL, path: '/api/v1/status' },
      { name: 'Traefik', url: 'http://traefik.traefik.svc.cluster.local:8080', path: '/ping' },
      { name: 'Cilium', url: 'http://cilium-agent.cilium.svc.cluster.local:9876', path: '/healthz' },
      { name: 'Velero', url: 'http://velero-velero.svc.cluster.local:8085', path: '/api/v1' },
      { name: 'MinIO', url: 'http://minio.velero.svc.cluster.local:9000', path: '/minio/health/live' },
    ];

    const results = await Promise.all(
      services.map(async (svc) => {
        try {
          const resp = await fetch(`${svc.url}${svc.path}`, { timeout: 5000 });
          return { ...svc, healthy: resp.ok, statusCode: resp.status };
        } catch {
          return { ...svc, healthy: false };
        }
      })
    );

    res.json({ status: 'success', result: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Certificates
// ---------------------------------------------------------------------------
app.get('/api/health/certs', requireAdmin, async (req, res) => {
  try {
    // Query cert-manager for cert statuses via Prometheus
    const certs = await prometheusQuery('cert_manager_certificate_not_after{status="ready"}');
    const results = (certs.data?.result || []).map(r => {
      const certName = r.metric.certificate || 'unknown';
      const epoch = parseFloat(r.value[1]);
      const expiry = new Date(epoch * 1000).toISOString();
      const daysLeft = Math.ceil((epoch * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        name: certName,
        expiry,
        daysRemaining: daysLeft,
        healthy: daysLeft > 30,
      };
    });
    res.json({ status: 'success', result: results });
  } catch (err) {
    res.json({ status: 'success', result: [] });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Dashboard Summary
// ---------------------------------------------------------------------------
app.get('/api/dashboard/summary', requireAdmin, async (req, res) => {
  try {
    const [nodes, pods, services, backups] = await Promise.all([
      prometheusQuery('count(kube_node_status_condition{condition="Ready",status="true"})'),
      prometheusQuery('count(kube_pod_status_phase{phase="Running"})'),
      prometheusQuery('count(kube_deployment_status_replicas_available)') || { data: { result: [] } },
      prometheusQuery('velero_backup_status_phase{phase="Completed"}') || { data: { result: [] } },
    ]);

    res.json({
      status: 'success',
      result: {
        readyNodes: parseInt(nodes.data?.result?.[0]?.value?.[1] || 0),
        runningPods: parseInt(pods.data?.result?.[0]?.value?.[1] || 0),
        availableServices: parseInt(services.data?.result?.[0]?.value?.[1] || 0),
        completedBackups: (backups.data?.result || []).length,
      },
    });
  } catch (err) {
    res.json({ status: 'success', result: { readyNodes: 0, runningPods: 0, availableServices: 0, completedBackups: 0 } });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Backup Status
// ---------------------------------------------------------------------------
app.get('/api/backup/status', requireAdmin, async (req, res) => {
  try {
    const backups = await prometheusQuery('velero_backup_info{status="Completed"}');
    const latest = await prometheusQuery('velero_backup_timestamp{status="Completed"}');

    const result = (backups.data?.result || []).map(r => {
      const name = r.label_name || r.backup || 'unknown';
      return { name, completed: true };
    });

    res.json({ status: 'success', result: { backups: result, total: result.length } });
  } catch (err) {
    res.json({ status: 'success', result: { backups: [], total: 0 } });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Audit Log
// ---------------------------------------------------------------------------
app.get('/api/audit', requireAdmin, async (req, res) => {
  try {
    // Read audit log from mounted volume or generate from Keycloak events
    const logPath = '/var/log/beckcloud/audit.log';
    if (fs.existsSync(logPath)) {
      const entries = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).slice(-100);
      res.json({ status: 'success', result: entries.reverse() });
    } else {
      res.json({ status: 'success', result: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — User Profile
// ---------------------------------------------------------------------------
app.get('/api/profile', requireAuth, (req, res) => {
  const user = req.session.user;
  res.json({
    status: 'success',
    result: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      roles: user.realm_access?.roles || [],
    },
  });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    // Update in Keycloak
    const kcUsers = await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(req.session.user.username)}`);
    const kcUser = kcUsers[0];

    if (kcUser) {
      await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users/${kcUser.id}`, 'PUT', {
        firstName: firstName || kcUser.firstName,
        lastName: lastName || kcUser.lastName,
        email: email || kcUser.email,
      });
    }

    // Update session
    if (firstName || lastName) {
      req.session.user.firstName = firstName || req.session.user.firstName;
      req.session.user.lastName = lastName || req.session.user.lastName;
    }

    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — User Groups (for profile page)
// ---------------------------------------------------------------------------
app.get('/api/profile/groups', requireAuth, async (req, res) => {
  try {
    // Get LLDAP groups for the user
    const userResp = await lldapGQL(
      `{ users(filter: {id: "${req.session.user.username}"}) { id groups { id displayName description } } }`
    );
    const user = userResp?.users?.[0];
    const groups = user?.groups || [];

    res.json({ status: 'success', result: groups });
  } catch (err) {
    res.json({ status: 'success', result: [] });
  }
});

// ---------------------------------------------------------------------------
// API Routes — User Tickets (for profile page)
// ---------------------------------------------------------------------------
app.get('/api/profile/tickets', requireAuth, async (req, res) => {
  try {
    const ticketsPath = '/var/lib/beckcloud/tickets.json';
    if (fs.existsSync(ticketsPath)) {
      const tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
      const userTickets = tickets.filter(t => t.userId === req.session.user.id || t.userId === req.session.user.username);
      res.json({ status: 'success', result: userTickets });
    } else {
      res.json({ status: 'success', result: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/ticket', requireAuth, async (req, res) => {
  try {
    const { title, description, service, priority } = req.body;
    const ticket = {
      id: Date.now().toString(),
      title,
      description,
      service,
      priority: priority || 'normal',
      userId: req.session.user.username,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Append to tickets file
    const ticketsPath = '/var/lib/beckcloud/tickets.json';
    let tickets = [];
    if (fs.existsSync(ticketsPath)) {
      tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
    }
    tickets.push(ticket);
    fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));

    res.status(201).json({ status: 'success', result: ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — User Sessions (for profile page)
// ---------------------------------------------------------------------------
app.get('/api/profile/sessions', requireAuth, (req, res) => {
  // Return session info
  res.json({
    status: 'success',
    result: {
      current: {
        id: req.sessionID,
        createdAt: req.session.createdAt ? new Date(req.session.createdAt).toISOString() : new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    },
  });
});

// ---------------------------------------------------------------------------
// API Routes — Security (for profile page)
// ---------------------------------------------------------------------------
app.get('/api/profile/security', requireAuth, async (req, res) => {
  try {
    const kcUsers = await keycloakAdminAPI(`/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(req.session.user.username)}`);
    const kcUser = kcUsers[0];
    const totp = kcUser?.totp || false;

    res.json({
      status: 'success',
      result: {
        twoFactorEnabled: totp,
        passwordLastChanged: kcUser?.lastPasswordReset || null,
        loginFailureCount: kcUser?.failureCount || 0,
      },
    });
  } catch (err) {
    res.json({ status: 'success', result: { twoFactorEnabled: false, passwordLastChanged: null, loginFailureCount: 0 } });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Avatar Upload (for profile page)
// ---------------------------------------------------------------------------
app.post('/api/profile/avatar', requireAuth, async (req, res) => {
  try {
    const { imageData } = req.body;
    // imageData is base64 encoded
    if (!imageData) {
      return res.status(400).json({ error: 'No image data' });
    }

    const uploadDir = '/tmp/beckcloud-avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${req.session.user.username}-${Date.now()}.png`;
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(path.join(uploadDir, fileName), base64Data, 'base64');

    res.json({
      status: 'success',
      result: { url: `/avatars/${fileName}` },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Tickets (admin)
// ---------------------------------------------------------------------------
app.get('/api/tickets', requireAdmin, async (req, res) => {
  try {
    const ticketsPath = '/var/lib/beckcloud/tickets.json';
    if (fs.existsSync(ticketsPath)) {
      const tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
      res.json({ status: 'success', result: tickets });
    } else {
      res.json({ status: 'success', result: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { title, description, service, priority } = req.body;
    const ticket = {
      id: Date.now().toString(),
      title,
      description,
      service,
      priority: priority || 'normal',
      userId: req.session.user.id,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Append to tickets file
    const ticketsPath = '/var/lib/beckcloud/tickets.json';
    let tickets = [];
    if (fs.existsSync(ticketsPath)) {
      tickets = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
    }
    tickets.push(ticket);
    fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));

    res.status(201).json({ status: 'success', result: ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Cluster Stats
// ---------------------------------------------------------------------------
app.get('/api/cluster/stats', requireAdmin, async (req, res) => {
  try {
    const [nodes, pods, storage] = await Promise.all([
      prometheusQuery('count(kube_node_status_condition{condition="Ready",status="true"})'),
      prometheusQuery('count(kube_pod_status_phase{phase="Running"})'),
      prometheusQuery('sum(kube_node_status_allocatable{resource="memory",unit="byte"}) / 1024 / 1024 / 1024'),
    ]);

    res.json({
      status: 'success',
      result: {
        readyNodes: parseInt(nodes.data?.result?.[0]?.value?.[1] || 0),
        runningPods: parseInt(pods.data?.result?.[0]?.value?.[1] || 0),
        totalMemoryGB: parseFloat(storage.data?.result?.[0]?.value?.[1] || 0),
      },
    });
  } catch (err) {
    res.json({ status: 'success', result: { readyNodes: 0, runningPods: 0, totalMemoryGB: 0 } });
  }
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(STATIC_ROOT, 'index.html'));
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`BeckCloud API Gateway listening on :${PORT}`);
  console.log(`  Keycloak:      ${KEYCLOAK_URL}`);
  console.log(`  LLDAP:         ${LLDAP_URL}`);
  console.log(`  Directus:      ${DIRECTUS_URL}`);
  console.log(`  Prometheus:    ${PROMETHEUS_URL}`);
  console.log(`  Redis:         ${REDIS_URL}`);
});

module.exports = app;
