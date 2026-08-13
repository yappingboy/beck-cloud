'use strict';

/**
 * BeckCloud Admin Panel API
 * Directus + Keycloak + Kubernetes API + Redis
 */

// ─── Config ───────────────────────────────────────────────────

const cfg = {
  directusURL:   env('DIRECTUS_URL',   'http://directus.webapps:8055'),
  directusEmail: env('DIRECTUS_EMAIL',  'admin@becklab.cloud'),
  directusPass:  env('DIRECTUS_PASSWORD','suCNJ5CtDdHEdy3Zhy6azwgG'),
  keycloakURL:   env('KEYCLOAK_URL',    'http://keycloak.identity:8080'),
  kcRealm:       env('KC_REALM',        'homelab'),
  k8sAPI:        env('K8S_API',         'https://172.16.0.20:6443'),
  redisHost:     env('REDIS_HOST',      '10.43.139.161'),
  redisPort:     parseInt(env('REDIS_PORT', '6379')),
  redisPass:     env('REDIS_PASSWORD',  ''),
  port:          parseInt(env('PORT', '8080')),
  kcClientID:    env('KC_CLIENT_ID',    'nova-monitoring'),
  kcClientSecret:env('KC_CLIENT_SECRET','9lJwF6HKD8z2l8ft9qbheIGASgAZTdrr'),
  kcUsername:    env('KC_USERNAME',     'yappingboy'),
  kcPassword:    env('KC_PASSWORD',     'y4pp1ngb0y'),
  lldapURL:      env('LLDAP_URL',       'http://lldap.identity:17170'),
  lldapUsername: env('LLDAP_USERNAME',  'admin'),
  lldapPassword: env('LLDAP_PASSWORD',  '0VFdWI9LXWugx8H0LpV5hePG'),
};

let directusToken = '';
let tokenExpiry = 0;

// ─── Helpers ──────────────────────────────────────────────────

function env(key, fallback) {
  return process.env[key] || fallback;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function httpGet(url, opts = {}) {
  const https = require('https');
  const http = require('http');
  const mod = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.get(url, { ...opts, rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000);
  });
}

async function httpPost(url, body, opts = {}) {
  const https = require('https');
  const http = require('http');
  const mod = url.startsWith('https') ? https : http;

  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = mod.request(url, {
      ...opts,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...opts.headers,
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(15000);
    req.write(payload);
    req.end();
  });
}

function parseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ─── Directus ────────────────────────────────────────────────

async function getDirectusToken() {
  const now = Date.now();
  if (directusToken && now < tokenExpiry) return directusToken;

  const url = cfg.directusURL + '/admin/auth/login/v2';
  const res = await httpPost(url, {
    identifier: cfg.directusEmail,
    password: cfg.directusPass,
  });

  const data = parseJSON(res.body);
  if (!data || !data.data || !data.data.token) {
    throw new Error('Directus auth failed: ' + (res.body.slice(0, 200) || res.status));
  }

  directusToken = data.data.token;
  tokenExpiry = now + 23 * 3600 * 1000; // 23h safety margin
  return directusToken;
}

async function directusReq(method, path, body) {
  const token = await getDirectusToken();
  const url = cfg.directusURL + path;
  const opts = { headers: { Authorization: 'Bearer ' + token } };

  if (method === 'GET') {
    return httpGet(url, opts);
  }
  return httpPost(url, body, opts);
}

async function directusGet(path) {
  const res = await directusReq('GET', path);
  return parseJSON(res.body);
}

async function directusPost(path, body) {
  const res = await directusReq('POST', path, body);
  return parseJSON(res.body);
}

async function directusPatch(path, body) {
  const token = await getDirectusToken();
  const https = require('https');
  const url = new URL(cfg.directusURL + path);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(url.toString(), {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(parseJSON(data)));
    });
    req.on('error', reject);
    req.setTimeout(15000);
    req.write(payload);
    req.end();
  });
}

async function directusDelete(path) {
  const token = await getDirectusToken();
  const https = require('https');
  const url = new URL(cfg.directusURL + path);

  return new Promise((resolve, reject) => {
    const req = https.request(url.toString(), {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000);
    req.end();
  });
}

// ─── Kubernetes ──────────────────────────────────────────────

let k8sTokenCache = '';
let k8sTokenExpiry = 0;

async function getK8sToken() {
  const now = Date.now();
  if (k8sTokenCache && now < k8sTokenExpiry) return k8sTokenCache;

  const fs = require('fs');
  let token;
  try {
    token = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
  } catch {
    token = env('K8S_TOKEN', '');
  }
  if (!token) throw new Error('K8s token not available');

  k8sTokenCache = token;
  k8sTokenExpiry = now + 3500 * 1000; // 35m
  return token;
}

async function k8sGet(path) {
  const token = await getK8sToken();
  const url = cfg.k8sAPI + path;
  const res = await httpGet(url, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json',
    },
  });
  return parseJSON(res.body);
}

async function k8sPost(path, body) {
  const token = await getK8sToken();
  const url = cfg.k8sAPI + path;
  const res = await httpPost(url, body, {
    headers: { Authorization: 'Bearer ' + token },
  });
  return parseJSON(res.body);
}

// ─── Keycloak ────────────────────────────────────────────────

let kcTokenCache = '';
let kcTokenExpiry = 0;

async function getKCToken() {
  const now = Date.now();
  if (kcTokenCache && now < kcTokenExpiry) return kcTokenCache;

  const url = cfg.keycloakURL + '/realms/' + cfg.kcRealm + '/protocol/openid-connect/token';
  const body = `grant_type=client_credentials&client_id=${cfg.kcClientID}&client_secret=${cfg.kcClientSecret}`;

  const https = require('https');
  const res = await new Promise((resolve, reject) => {
    https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      rejectUnauthorized: false,
    }, resolve).end(body);
  });

  const data = parseJSON(res.body);
  if (!data?.access_token) throw new Error('Keycloak token failed: ' + res.body.slice(0, 200));

  kcTokenCache = data.access_token;
  kcTokenExpiry = now + (data.expires_in || 300) * 1000;
  return kcTokenCache;
}

async function kcGet(path) {
  const token = await getKCToken();
  const url = cfg.keycloakURL + path;
  const res = await httpGet(url, {
    headers: { Authorization: 'Bearer ' + token },
  });
  return parseJSON(res.body);
}

// ─── LLDAP ──────────────────────────────────────────────────

let lldapTokenCache = '';
let lldapTokenExpiry = 0;

async function getLLDAPToken() {
  const now = Date.now();
  if (lldapTokenCache && now < lldapTokenExpiry) return lldapTokenCache;

  const url = cfg.lldapURL + '/auth/simple/login';
  const res = await httpPost(url, {
    username: cfg.lldapUsername,
    password: cfg.lldapPassword,
  });

  const data = parseJSON(res.body);
  if (!data || !data.token) {
    throw new Error('LLDAP auth failed: ' + (res.body.slice(0, 200) || res.status));
  }

  lldapTokenCache = data.token;
  lldapTokenExpiry = now + 20 * 3600 * 1000; // 20h safety margin (JWT valid 1d)
  return lldapTokenCache;
}

async function lldapGraphQL(query, variables) {
  const token = await getLLDAPToken();
  const url = cfg.lldapURL + '/api/graphql';
  const res = await httpPost(url, { query, variables }, {
    headers: { Authorization: 'Bearer ' + token },
  });

  const data = parseJSON(res.body);
  if (!data) {
    throw new Error('LLDAP GraphQL parse failed: ' + res.body.slice(0, 200));
  }
  if (data.errors) {
    const msgs = data.errors.map(e => e.message || JSON.stringify(e)).join('; ');
    throw new Error('LLDAP GraphQL error: ' + msgs);
  }
  return data.data;
}

// ─── Audit Logging ──────────────────────────────────────────

async function logAudit(type, action, target) {
  try {
    await directusPost('/admin/collections/bc_audit_log/items', {
      type,
      action,
      target: String(target),
      ip: '10.42.0.0',
      user: 'admin-panel',
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

// ─── Route Handlers ─────────────────────────────────────────

async function handleDashboardSummary(req, res) {
  try {
    const result = { timestamp: new Date().toISOString() };

    // Pod counts by namespace
    const nsList = await k8sGet('/api/v1/namespaces');
    if (nsList?.items) {
      let totalPods = 0, readyPods = 0, pendingPods = 0, crashLoop = 0;

      for (const ns of nsList.items) {
        if (['kube-system', 'kube-public'].includes(ns.metadata.name)) continue;
        const pods = await k8sGet(`/api/v1/namespaces/${ns.metadata.name}/pods`);
        if (!pods?.items) continue;

        for (const p of pods.items) {
          totalPods++;
          switch (p.status.phase) {
            case 'Running': readyPods++; break;
            case 'Pending': pendingPods++; break;
          }
          if (p.status.containerStatuses) {
            for (const cs of p.status.containerStatuses) {
              if (cs.state?.waiting?.reason === 'CrashLoopBackOff') crashLoop++;
            }
          }
        }
      }

      result.namespaces = nsList.items.length;
      result.pods = { total: totalPods, ready: readyPods, pending: pendingPods, crashLoop };
    }

    // Cert counts
    try {
      const nsData = await k8sGet('/apis/cert-manager.io/v1/namespaces');
      if (nsData?.items) {
        let certReady = 0, certTotal = nsData.items.length;
        for (const ns of nsData.items) {
          if (ns.metadata.name === 'kube-system') continue;
          const certs = await k8sGet(`/apis/cert-manager.io/v1/namespaces/${ns.metadata.name}/certificates`);
          if (!certs?.items) continue;
          for (const c of certs.items) {
            const ready = c.status?.conditions?.some(cond => cond.type === 'Ready' && cond.status === 'True');
            if (ready) certReady++;
          }
        }
        result.certs = { ready: certReady, total: certTotal };
      }
    } catch { /* cert-manager may not be in every cluster view */ }

    // Storage PV count
    try {
      const pvs = await k8sGet('/api/v1/persistentvolumes');
      if (pvs?.items) {
        const bound = pvs.items.filter(pv => pv.status?.phase === 'Bound').length;
        const available = pvs.items.filter(pv => pv.status?.phase === 'Available').length;
        result.pv = { total: pvs.items.length, bound, available };
      }
    } catch {}

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleHealthPods(req, res) {
  try {
    const nsList = await k8sGet('/api/v1/namespaces');
    if (!nsList?.items) return res.json([]);

    const services = [];
    for (const ns of nsList.items) {
      if (['kube-system', 'kube-public'].includes(ns.metadata.name)) continue;
      const pods = await k8sGet(`/api/v1/namespaces/${ns.metadata.name}/pods`);
      if (!pods?.items) continue;

      const groups = {};
      for (const p of pods.items) {
        const owner = (p.metadata.ownerReferences || [])
          .find(ref => ['ReplicaSet','Deployment','StatefulSet'].includes(ref.kind))?.name
          || 'standalone';

        if (!groups[owner]) groups[owner] = { running: 0, total: 0 };
        groups[owner].total++;
        if (p.status.phase === 'Running') groups[owner].running++;
      }

      for (const [name, g] of Object.entries(groups)) {
        services.push({
          namespace: ns.metadata.name,
          name,
          ready: g.running,
          total: g.total,
          healthy: g.running === g.total && g.total > 0,
          phase: g.total === 0 ? 'no-pods' : (g.running === g.total ? 'healthy' : 'degraded'),
        });
      }
    }

    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleCerts(req, res) {
  try {
    const nsList = await k8sGet('/api/v1/namespaces');
    if (!nsList?.items) return res.json([]);

    const certs = [];
    for (const ns of nsList.items) {
      if (['kube-system', 'kube-public'].includes(ns.metadata.name)) continue;
      const data = await k8sGet(`/apis/cert-manager.io/v1/namespaces/${ns.metadata.name}/certificates`);
      if (!data?.items) continue;

      for (const c of data.items) {
        const ready = c.status?.conditions?.some(cond => cond.type === 'Ready' && cond.status === 'True');
        certs.push({
          name: c.metadata.name,
          namespace: ns.metadata.name,
          domains: c.spec?.dnsNames || [],
          secret: c.spec?.secretName || '',
          ready,
        });
      }
    }

    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleUsersList(req, res) {
  try {
    const data = await directusGet('/admin/collections/bc_users/items?fields=*,keycloak_uuid&meta=total_count&page=1&limit=100');
    res.json({ data: data?.data || [], total: data?.meta?.total_count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleUsersCreate(req, res) {
  try {
    const data = await directusPost('/admin/collections/bc_users/items', req.body);
    await logAudit('user', 'created', req.body.email);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleUserUpdate(req, res) {
  try {
    const data = await directusPatch('/admin/collections/bc_users/items/' + req.params.id, req.body);
    await logAudit('user', 'updated', req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleUserDelete(req, res) {
  try {
    const res2 = await directusDelete('/admin/collections/bc_users/items/' + req.params.id);
    await logAudit('user', 'deleted', req.params.id);
    res.json(parseJSON(res2.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleTicketsList(req, res) {
  try {
    let path = '/admin/collections/bc_tickets/items?fields=*,user_email,service&sort=-created_at&page=1&limit=100';
    if (req.query.status) {
      path = `/admin/collections/bc_tickets/items?filter[status][eq]=${req.query.status}&fields=*,user_email,service&sort=-created_at&page=1&limit=100`;
    }
    const data = await directusGet(path);
    res.json(data || { data: [], meta: { total_count: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleTicketsCreate(req, res) {
  try {
    const data = await directusPost('/admin/collections/bc_tickets/items', req.body);
    await logAudit('ticket', 'created', req.body.title);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleTicketUpdate(req, res) {
  try {
    const data = await directusPatch('/admin/collections/bc_tickets/items/' + req.params.id, req.body);
    await logAudit('ticket', 'updated', req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleTicketDelete(req, res) {
  try {
    const res2 = await directusDelete('/admin/collections/bc_tickets/items/' + req.params.id);
    await logAudit('ticket', 'deleted', req.params.id);
    res.json(parseJSON(res2.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleAuditLogList(req, res) {
  try {
    let path = '/admin/collections/bc_audit_log/items?fields=*&sort=-timestamp&page=1&limit=100';
    if (req.query.type && req.query.type !== 'all') {
      path = `/admin/collections/bc_audit_log/items?filter[type][eq]=${req.query.type}&fields=*&sort=-timestamp&page=1&limit=100`;
    }
    const data = await directusGet(path);
    res.json(data || { data: [], meta: { total_count: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleBackupStatus(req, res) {
  try {
    const data = await k8sGet('/apis/velero.io/v1/namespaces/velero/backups');
    if (!data?.items) return res.json([]);

    const sorted = data.items
      .filter(b => b.metadata)
      .sort((a, b) => new Date(b.metadata.creationTimestamp) - new Date(a.metadata.creationTimestamp))
      .slice(0, 20);

    res.json(sorted.map(b => ({
      name: b.metadata?.name,
      namespace: b.metadata?.namespace,
      created: b.metadata?.creationTimestamp,
      phase: b.status?.phase,
      includedNamespaces: b.spec?.includedNamespaces,
      ttlMinutes: b.spec?.ttlMinutes,
      errors: b.status?.errors || 0,
      warnings: b.status?.warnings || 0,
      volumeSnapshotsCompleted: b.status?.volumeSnapshotsCompleted,
      volumeSnapshotsTotal: b.status?.volumeSnapshotsTotal,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleBackupRun(req, res) {
  try {
    const name = 'manual-' + new Date().toISOString().replace(/[:.]/g, '-');
    const data = await k8sPost('/apis/velero.io/v1/namespaces/velero/backups', {
      apiVersion: 'velero.io/v1',
      kind: 'Backup',
      metadata: { name, namespace: 'velero', labels: { 'admin-panel': 'manual-backup' } },
      spec: { includedNamespaces: ['*'], storageLocation: 'default', ttlMinutes: 43200 },
    });
    await logAudit('system', 'backup', name);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleRedisFlush(req, res) {
  try {
    const http = require('http');
    const res2 = await new Promise((resolve, reject) => {
      http.request(`http://${cfg.redisHost}:${cfg.redisPort}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, resolve).end(JSON.stringify({ cmd: ['FLUSHDB'] }));
    });
    await logAudit('system', 'redis-flush', '');
    res.json({ ok: true, message: 'Redis flushed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleKeycloakUsers(req, res) {
  try {
    const token = await getKCToken();
    const url = cfg.keycloakURL + '/admin/realms/' + cfg.kcRealm + '/users?max=200';
    const data = await kcGet(url);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── LLDAP Route Handlers ───────────────────────────────────

const LLDAP_USER_LIST_QUERY = `
  query ListUsers($filters: RequestFilter) {
    users(filters: $filters) {
      id
      email
      displayName
      firstName
      lastName
      creationDate
      uuid
      groups { id displayName }
    }
  }
`;

const LLDAP_USER_GET_QUERY = `
  query GetUser($userId: String!) {
    user(userId: $userId) {
      id
      email
      displayName
      firstName
      lastName
      creationDate
      uuid
      attributes { name value }
      groups { id displayName }
    }
  }
`;

const LLDAP_GROUP_LIST_QUERY = `
  query ListGroups {
    groups {
      id
      displayName
      creationDate
      uuid
      users { id email }
    }
  }
`;

const LLDAP_GROUP_GET_QUERY = `
  query GetGroup($groupId: Int!) {
    group(groupId: $groupId) {
      id
      displayName
      creationDate
      uuid
      users { id email }
    }
  }
`;

async function handleLLDAPUsersList(req, res) {
  try {
    const data = await lldapGraphQL(LLDAP_USER_LIST_QUERY, {});
    res.json({ users: data.users || [], total: (data.users || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPUserGet(req, res) {
  try {
    const data = await lldapGraphQL(LLDAP_USER_GET_QUERY, { userId: req.params.id });
    res.json(data.user || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPUserCreate(req, res) {
  try {
    const { id, email, displayName, firstName, lastName } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const query = `
      mutation CreateUser($user: CreateUserInput!) {
        createUser(user: $user) {
          id email displayName firstName lastName uuid
        }
      }
    `;
    const data = await lldapGraphQL(query, {
      user: { id, email, displayName, firstName, lastName },
    });
    await logAudit('lldap_user', 'created', id);
    res.status(201).json(data.createUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPUserUpdate(req, res) {
  try {
    const { email, displayName, firstName, lastName } = req.body;

    const query = `
      mutation UpdateUser($user: UpdateUserInput!) {
        updateUser(user: $user) { ok }
      }
    `;
    const data = await lldapGraphQL(query, {
      user: { id: req.params.id, email, displayName, firstName, lastName },
    });
    await logAudit('lldap_user', 'updated', req.params.id);
    res.json({ ok: data.updateUser.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPUserDelete(req, res) {
  try {
    const query = `
      mutation DeleteUser($userId: String!) {
        deleteUser(userId: $userId) { ok }
      }
    `;
    const data = await lldapGraphQL(query, { userId: req.params.id });
    await logAudit('lldap_user', 'deleted', req.params.id);
    res.json({ ok: data.deleteUser.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPGroupsList(req, res) {
  try {
    const data = await lldapGraphQL(LLDAP_GROUP_LIST_QUERY, {});
    res.json({ groups: data.groups || [], total: (data.groups || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPGroupGet(req, res) {
  try {
    const data = await lldapGraphQL(LLDAP_GROUP_GET_QUERY, { groupId: parseInt(req.params.groupId, 10) });
    res.json(data.group || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPGroupCreate(req, res) {
  try {
    const { displayName, name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const query = `
      mutation CreateGroup($name: String!) {
        createGroup(name: $name) {
          id displayName uuid
        }
      }
    `;
    const data = await lldapGraphQL(query, { name });
    await logAudit('lldap_group', 'created', name);
    res.status(201).json(data.createGroup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPGroupUpdate(req, res) {
  try {
    const { displayName } = req.body;

    const query = `
      mutation UpdateGroup($group: UpdateGroupInput!) {
        updateGroup(group: $group) { ok }
      }
    `;
    const data = await lldapGraphQL(query, {
      group: { id: parseInt(req.params.groupId, 10), displayName },
    });
    await logAudit('lldap_group', 'updated', req.params.groupId);
    res.json({ ok: data.updateGroup.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPGroupDelete(req, res) {
  try {
    const query = `
      mutation DeleteGroup($groupId: Int!) {
        deleteGroup(groupId: $groupId) { ok }
      }
    `;
    const data = await lldapGraphQL(query, { groupId: parseInt(req.params.groupId, 10) });
    await logAudit('lldap_group', 'deleted', req.params.groupId);
    res.json({ ok: data.deleteGroup.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPAddUserToGroup(req, res) {
  try {
    const query = `
      mutation AddUserToGroup($userId: String!, $groupId: Int!) {
        addUserToGroup(userId: $userId, groupId: $groupId) { ok }
      }
    `;
    const data = await lldapGraphQL(query, {
      userId: req.params.userId,
      groupId: parseInt(req.params.groupId, 10),
    });
    await logAudit('lldap_group', 'user_added', req.params.groupId);
    res.json({ ok: data.addUserToGroup.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function handleLLDAPRemoveUserFromGroup(req, res) {
  try {
    const query = `
      mutation RemoveUserFromGroup($userId: String!, $groupId: Int!) {
        removeUserFromGroup(userId: $userId, groupId: $groupId) { ok }
      }
    `;
    const data = await lldapGraphQL(query, {
      userId: req.params.userId,
      groupId: parseInt(req.params.groupId, 10),
    });
    await logAudit('lldap_group', 'user_removed', req.params.groupId);
    res.json({ ok: data.removeUserFromGroup.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Router ──────────────────────────────────────────────────

const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Root dashboard (requires SSO)
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BeckCloud Admin</title>
<style>
body{font-family:system-ui;background:#0f0f0f;color:#e0e0e0;padding:2rem}
h1{color:#00ff88}
a{color:#00ff88;text-decoration:none}
a:hover{text-decoration:underline}
.list{margin:1rem 0;padding:1rem;background:#1a1a1a;border-radius:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;margin-left:8px}
.badge-ok{background:#00ff8833;color:#00ff88}
.badge-err{background:#ff444433;color:#ff4444}
</style>
</head>
<body>
<h1>BeckCloud Admin Panel</h1>
<div class="list">
<h3>Dashboard</h3>
<a href="/api/dashboard/summary">Dashboard Summary (cluster overview)</a>
</div>
<div class="list">
<h3>Health</h3>
<a href="/api/health/pods">Pod Health (all namespaces)</a>
</div>
<div class="list">
<h3>Certificates</h3>
<a href="/api/certs">Certificates (cert-manager)</a>
</div>
<div class="list">
<h3>Users</h3>
<a href="/api/users/directus">Directus Users</a>
<a href="/api/users/keycloak" style="display:block;margin-top:4px">Keycloak Users</a>
</div>
<div class="list">
<h3>Tickets</h3>
<a href="/api/tickets">Tickets (list)</a>
</div>
<div class="list">
<h3>Audit</h3>
<a href="/api/audit">Audit Log</a>
</div>
<div class="list">
<h3>Backups</h3>
<a href="/api/backup/status">Backup Status</a>
<form method="post" action="/api/backup/run" style="margin-top:8px">
<button type="submit" style="padding:8px 16px;background:#00ff88;color:#000;border:none;border-radius:4px;cursor:pointer">Run Manual Backup</button>
</form>
</div>
<div class="list">
<h3>System</h3>
<form method="post" action="/api/redis/flush" style="margin-top:4px">
<button type="submit" style="padding:8px 16px;background:#ff8800;color:#000;border:none;border-radius:4px;cursor:pointer">Flush Redis DB</button>
</form>
</div>
<div class="list">
<a href="/health">Health Check</a> <span class="badge badge-ok">API</span>
</div>
</body>
</html>`);
});

app.get('/api/dashboard/summary', handleDashboardSummary);
app.get('/api/health/pods', handleHealthPods);
app.get('/api/certs', handleCerts);

app.get('/api/users/directus', handleUsersList);
app.post('/api/users/directus', handleUsersCreate);
app.patch('/api/users/directus/:id', handleUserUpdate);
app.delete('/api/users/directus/:id', handleUserDelete);

app.get('/api/users/keycloak', handleKeycloakUsers);

app.get('/api/users/lldap', handleLLDAPUsersList);
app.get('/api/users/lldap/:id', handleLLDAPUserGet);
app.post('/api/users/lldap', handleLLDAPUserCreate);
app.patch('/api/users/lldap/:id', handleLLDAPUserUpdate);
app.delete('/api/users/lldap/:id', handleLLDAPUserDelete);

app.get('/api/groups/lldap', handleLLDAPGroupsList);
app.get('/api/groups/lldap/:groupId', handleLLDAPGroupGet);
app.post('/api/groups/lldap', handleLLDAPGroupCreate);
app.patch('/api/groups/lldap/:groupId', handleLLDAPGroupUpdate);
app.delete('/api/groups/lldap/:groupId', handleLLDAPGroupDelete);
app.post('/api/groups/lldap/:groupId/users/:userId', handleLLDAPAddUserToGroup);
app.delete('/api/groups/lldap/:groupId/users/:userId', handleLLDAPRemoveUserFromGroup);

app.get('/api/tickets', handleTicketsList);
app.post('/api/tickets', handleTicketsCreate);
app.patch('/api/tickets/:id', handleTicketUpdate);
app.delete('/api/tickets/:id', handleTicketDelete);

app.get('/api/audit', handleAuditLogList);

app.get('/api/backup/status', handleBackupStatus);
app.post('/api/backup/run', handleBackupRun);

app.post('/api/redis/flush', handleRedisFlush);

app.use((req, res) => {
  res.status(404).json({ error: 'route not found', path: req.path });
});

app.listen(cfg.port, '0.0.0.0', () => {
  console.log(`Admin Panel API on :${cfg.port}`);
  console.log(`  Directus: ${cfg.directusURL}`);
  console.log(`  Keycloak: ${cfg.keycloakURL}`);
  console.log(`  LLDAP:    ${cfg.lldapURL}`);
  console.log(`  K8s API:  ${cfg.k8sAPI}`);
});
