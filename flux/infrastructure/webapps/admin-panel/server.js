/**
 * BeckCloud Admin Panel — Backend API Server
 * Serves static files AND provides real API endpoints.
 * Uses only Node.js built-in modules (no npm dependencies).
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;
const K8S_API = process.env.K8S_API || 'https://172.16.0.20:6443';
const STATIC_DIR = '/app/static';
const SA_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const REDIS_HOST = '10.43.139.161';
const REDIS_PORT = 6379;
const REDIS_PASSWORD = 'n2GhqVLqsP44FbrZRtKIY8JOYyiHuZkVrLI37dJR0TI=';
const KC_TOKEN_URL = 'http://keycloak.identity:8080/realms/homelab/protocol/openid-connect/token';
const KC_ADMIN_URL = 'http://keycloak.identity:8080/admin/realms/homelab';

let caCert = null;
try {
  caCert = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8');
} catch (e) {
  // Running outside K8s or cert not available
}

let saToken = '';
try {
  saToken = fs.readFileSync(SA_TOKEN_PATH, 'utf8').trim();
} catch (e) {
  // Running outside K8s
}

// ---- K8s API helpers ----

function k8sGet(subpath, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '172.16.0.20',
      port: 6443,
      path: subpath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token || saToken}`,
        'Accept': 'application/json',
      },
      ca: caCert,
      rejectUnauthorized: !!caCert,
      timeout: 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        } else {
          resolve({ error: data, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('K8s API timeout')); });
    req.end();
  });
}

function k8sPost(subpath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: '172.16.0.20',
      port: 6443,
      path: subpath,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || saToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ca: caCert,
      rejectUnauthorized: !!caCert,
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ ok: true }); }
        } else {
          resolve({ error: data, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('K8s API timeout')); });
    req.write(payload);
    req.end();
  });
}

// ---- Keycloak helpers ----

let kcAccessToken = null;
let kcTokenExpiry = 0;

async function getKCToken() {
  if (kcAccessToken && Date.now() < kcTokenExpiry) return kcAccessToken;
  try {
    const formData = new URLSearchParams({
      grant_type: 'password',
      client_id: 'nova-monitoring',
      username: 'yappingboy',
      password: 'y4pp1ngb0y',
    }).toString();
    const opts = {
      hostname: 'keycloak.identity',
      port: 8080,
      path: '/realms/homelab/protocol/openid-connect/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    };
    return new Promise((resolve, reject) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            kcAccessToken = parsed.access_token;
            kcTokenExpiry = Date.now() + (parsed.expires_in * 1000) - 60000; // 1min buffer
            resolve(kcAccessToken);
          } catch { reject(new Error('Keycloak token parse failed')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('KC timeout')); });
      req.write(formData);
      req.end();
    });
  } catch (e) {
    console.error('Keycloak token error:', e.message);
    return null;
  }
}

async function kcGet(path) {
  const token = await getKCToken();
  if (!token) return { error: 'Could not get Keycloak token' };
  return new Promise((resolve) => {
    const opts = {
      hostname: 'keycloak.identity',
      port: 8080,
      path: `/admin/realms/homelab${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); }
        } else {
          resolve({ error: data, status: res.statusCode });
        }
      });
    });
    req.on('error', () => resolve({ error: 'Keycloak connection failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'KC timeout' }); });
    req.end();
  });
}

async function kcPost(path, body) {
  const token = await getKCToken();
  if (!token) return { error: 'Could not get Keycloak token' };
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const opts = {
      hostname: 'keycloak.identity',
      port: 8080,
      path: `/admin/realms/homelab${path}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ ok: true }); }
        } else {
          resolve({ error: data, status: res.statusCode });
        }
      });
    });
    req.on('error', () => resolve({ error: 'Keycloak connection failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'KC timeout' }); });
    req.write(payload);
    req.end();
  });
}

// ---- Redis helper (simple telnet-style protocol) ----

function redisCmd(cmd) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = net.createConnection({ host: REDIS_HOST, port: REDIS_PORT }, () => {
      socket.write(`AUTH ${REDIS_PASSWORD}\r\n`);
    });
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\r\n')) {
        const lines = buffer.split('\r\n');
        if (lines.length > 0 && !lines[0].startsWith('-')) {
          // Parse RESP response
          const firstLine = lines[0];
          if (firstLine === '+OK') {
            resolve({ ok: true });
          } else if (firstLine.startsWith('$')) {
            // Bulk string
            const len = parseInt(firstLine.slice(1));
            if (len === -1) { resolve(null); }
            else {
              const idx = buffer.indexOf('\r\n');
              const val = buffer.slice(idx + 2, idx + 2 + len);
              resolve(val);
            }
          } else if (firstLine.startsWith('*')) {
            // Array
            const count = parseInt(firstLine.slice(1));
            if (count === -1) { resolve(null); }
            else {
              const idx = buffer.indexOf('\r\n');
              const start = idx + 2;
              const arr = [];
              let pos = start;
              for (let i = 0; i < count; i++) {
                const line = buffer.slice(pos, pos + buffer.slice(pos).indexOf('\r\n'));
                if (line.startsWith('$')) {
                  const len = parseInt(line.slice(1));
                  if (len === -1) { arr.push(null); pos = line.indexOf('\r\n\r\n') + 4; }
                  else {
                    const valStart = line.indexOf('\r\n') + 2;
                    arr.push(buffer.slice(pos + valStart, pos + valStart + len));
                    pos = pos + valStart + len + 2; // skip \r\n
                  }
                } else { pos += line.length + 2; }
              }
              resolve(arr);
            }
          } else {
            resolve(firstLine);
          }
          socket.end();
        }
      }
    });
    socket.on('error', () => resolve({ error: 'Redis connection failed' }));
    socket.on('timeout', () => { socket.end(); resolve({ error: 'Redis timeout' }); });
    setTimeout(() => { socket.end(); resolve({ error: 'Redis timeout' }); }, 5000);

    // Send the command
    setTimeout(() => {
      const args = Array.isArray(cmd) ? cmd : [cmd];
      socket.write(`*${args.length}\r\n`);
      args.forEach(arg => {
        const s = arg.toString();
        socket.write(`$${s.length}\r\n${s}\r\n`);
      });
    }, 100);
  });
}

// ---- API Routes ----

const API_ROUTES = {
  // Health endpoints
  'GET /api/health/pods': async () => {
    try {
      const data = await k8sGet('/api/v1/namespaces');
      const results = {};
      if (data.items) {
        for (const ns of data.items) {
          const pods = await k8sGet(`/api/v1/namespaces/${ns.metadata.name}/pods`);
          if (pods.items) {
            results[ns.metadata.name] = {
              total: pods.items.length,
              ready: pods.items.filter(p => p.status?.phase === 'Running').length,
              pending: pods.items.filter(p => p.status?.phase === 'Pending').length,
              crashLoop: pods.items.filter(p => p.status?.containerStatuses?.some(c => c.state?.waiting?.reason === 'CrashLoopBackOff')).length,
            };
          }
        }
      }
      return results;
    } catch (e) {
      return { error: e.message };
    }
  },

  'GET /api/health/nodes': async () => {
    try {
      const data = await k8sGet('/api/v1/nodes');
      if (data.items) {
        return data.items.map(n => ({
          name: n.metadata.name,
          ready: n.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True'),
          roles: Object.keys(n.metadata.labels || {}).filter(k =>
            ['node-role.kubernetes.io/', 'kubernetes.io/role'].some(prefix => k.startsWith(prefix))
          ),
          capacity: n.status?.allocatable,
          conditions: (n.status?.conditions || []).map(c => ({ type: c.type, status: c.status })),
        }));
      }
      return [];
    } catch (e) {
      return { error: e.message };
    }
  },

  'GET /api/health/services': async () => {
    try {
      // Get pods and compute health per deployment/service
      const data = await k8sGet('/api/v1/namespaces');
      const results = [];
      if (data.items) {
        for (const ns of data.items) {
          const nsName = ns.metadata.name;
          if (['kube-system', 'kube-public'].includes(nsName)) continue;
          const pods = await k8sGet(`/api/v1/namespaces/${nsName}/pods`);
          if (pods.items) {
            // Group by owner
            const groups = {};
            pods.items.forEach(p => {
              const owner = (p.metadata?.ownerReferences || [])[0]?.name || 'standalone';
              if (!groups[owner]) groups[owner] = { namespace: nsName, pods: [] };
              groups[owner].pods.push(p);
            });
            for (const [name, group] of Object.entries(groups)) {
              const running = group.pods.filter(p => p.status?.phase === 'Running').length;
              const total = group.pods.length;
              results.push({
                namespace: nsName,
                name,
                ready: running,
                total,
                healthy: running === total && total > 0,
                phase: total === 0 ? 'no-pods' : (running === total ? 'healthy' : 'degraded'),
              });
            }
          }
        }
      }
      return results;
    } catch (e) {
      return { error: e.message };
    }
  },

  'GET /api/health/certs': async () => {
    try {
      const data = await k8sGet('/apis/cert-manager.io/v1/namespaces');
      if (data.items) {
        const certs = [];
        for (const ns of data.items) {
          const nsCerts = await k8sGet(`/apis/cert-manager.io/v1/namespaces/${ns.metadata.name}/certificates`);
          if (nsCerts.items) {
            nsCerts.items.forEach(c => {
              const conditions = (c.status?.conditions || []).find(c => c.type === 'Ready');
              const secretName = c.spec?.dnsNames || [];
              certs.push({
                name: c.metadata.name,
                namespace: ns.metadata.name,
                domains: secretName,
                secret: c.spec?.secretName,
                ready: conditions?.status === 'True',
                lastTransition: conditions?.lastTransitionTime,
              });
            });
          }
        }
        return certs;
      }
      return { error: 'cert-manager not found' };
    } catch (e) {
      return { error: e.message };
    }
  },

  // Velero
  'GET /api/backup/status': async () => {
    try {
      const data = await k8sGet('/apis/velero.io/v1/namespaces/velero/backups');
      if (data.items) {
        return data.items.map(b => ({
          name: b.metadata.name,
          namespace: b.metadata.namespace,
          status: b.status?.phase || 'unknown',
          started: b.metadata?.creationTimestamp,
          expiration: b.spec?.ttlMinutes,
          includedNamespaces: b.spec?.includedNamespaces,
          labels: b.metadata?.labels || {},
        })).sort((a, b) => new Date(b.started) - new Date(a.started)).slice(0, 20);
      }
      return [];
    } catch (e) {
      return { error: e.message };
    }
  },

  'POST /api/backup/run': async () => {
    try {
      const backupName = `manual-${Date.now()}`;
      const body = {
        apiVersion: 'velero.io/v1',
        kind: 'Backup',
        metadata: {
          name: backupName,
          namespace: 'velero',
          labels: {
            'admin-panel': 'manual-backup',
            'created-by': 'admin-panel-api',
          },
        },
        spec: {
          includedNamespaces: ['*'],
          storageLocation: 'default',
          ttl: '720h', // 30 days
        },
      };
      const result = await k8sPost('/apis/velero.io/v1/namespaces/velero/backups', body);
      if (result.error) return { error: result.error, status: result.status };
      return { ok: true, backupName };
    } catch (e) {
      return { error: e.message };
    }
  },

  // Keycloak users
  'GET /api/users/keycloak': async () => {
    try {
      const data = await kcGet('/users?max=100');
      if (data.error) return { error: data.error };
      return data.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        enabled: u.enabled,
        emailVerified: u.emailVerified,
        created: u.createdTimestamp ? new Date(u.createdTimestamp).toISOString() : null,
        groups: (u.groups || []).map(g => g.name),
      }));
    } catch (e) {
      return { error: e.message };
    }
  },

  'POST /api/users/keycloak': async (body) => {
    try {
      const result = await kcPost('/users', {
        username: body.username,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        enabled: true,
        emailVerified: false,
        credentials: [{ type: 'temporary', value: body.password, temporary: true }],
      });
      if (result.error) return result;
      // Extract user ID from Location header or response
      return { ok: true, message: `User ${body.username} created` };
    } catch (e) {
      return { error: e.message };
    }
  },

  'POST /api/users/keycloak/:id/reset-password': async (body) => {
    try {
      const result = await kcPost(`/users/${body.id}/reset-password`, {
        type: 'password',
        value: body.password,
        temporary: false,
      });
      if (result.error) return result;
      return { ok: true, message: 'Password reset successfully' };
    } catch (e) {
      return { error: e.message };
    }
  },

  'DELETE /api/users/keycloak/:id': async (params) => {
    try {
      const result = await kcPost(`/users/${params.id}`, {});
      return { ok: true, message: 'User deleted' };
    } catch (e) {
      return { error: e.message };
    }
  },

  // Redis
  'POST /api/redis/flush': async () => {
    try {
      const result = await redisCmd('FLUSHDB');
      if (result.error) return result;
      return { ok: true, message: 'Redis DB flushed' };
    } catch (e) {
      return { error: e.message };
    }
  },

  'GET /api/redis/stats': async () => {
    try {
      const info = await redisCmd('INFO memory');
      if (info.error) return info;
      // Parse INFO output
      const lines = info.split('\r\n').filter(l => l && !l.startsWith('#'));
      const stats = {};
      lines.forEach(l => {
        const [k, v] = l.split(':');
        if (k && v) stats[k] = v;
      });
      return stats;
    } catch (e) {
      return { error: e.message };
    }
  },

  // Pod management
  'POST /api/pods/:namespace/:name/restart': async (params) => {
    try {
      const ns = params.namespace;
      const name = params.name;
      const data = await k8sGet(`/api/v1/namespaces/${ns}/pods/${name}`);
      if (data.error) return data;
      const pod = data;
      // Check if owned by a deployment
      const owner = (pod.metadata?.ownerReferences || [])[0];
      if (owner?.kind === 'ReplicaSet') {
        // Check if ReplicaSet is owned by a Deployment
        const rsData = await k8sGet(`/apis/apps/v1/namespaces/${ns}/replicasets/${name}`);
        if (rsData.ownerReferences?.[0]?.kind === 'Deployment') {
          // Delete pod to trigger restart
          await k8sPost(`/api/v1/namespaces/${ns}/pods/${name}`, {});
          return { ok: true, message: `Pod ${name} in ${ns} deleted (will be restarted by deployment)` };
        }
      }
      // Direct pod delete
      await k8sPost(`/api/v1/namespaces/${ns}/pods/${name}`, {});
      return { ok: true, message: `Pod ${name} in ${ns} deleted` };
    } catch (e) {
      return { error: e.message };
    }
  },

  // OAuth2-proxy restart
  'POST /api/services/oauth2-proxy/restart': async () => {
    try {
      // Get oauth2-proxy pods
      const pods = await k8sGet('/api/v1/namespaces/identity/pods');
      if (pods.items) {
        const proxyPods = pods.items.filter(p => p.metadata.name.includes('oauth2-proxy'));
        for (const pod of proxyPods) {
          await k8sPost(`/api/v1/namespaces/identity/pods/${pod.metadata.name}`, {});
        }
        return { ok: true, message: `Restarted ${proxyPods.length} oauth2-proxy pod(s)` };
      }
      return { error: 'No oauth2-proxy pods found' };
    } catch (e) {
      return { error: e.message };
    }
  },

  // Dashboard summary
  'GET /api/dashboard/summary': async () => {
    try {
      const podsData = await k8sGet('/api/v1/namespaces');
      let totalNs = 0, totalPods = 0, readyPods = 0, pendingPods = 0, crashLoop = 0;

      if (podsData.items) {
        totalNs = podsData.items.length;
        for (const ns of podsData.items) {
          const nsPods = await k8sGet(`/api/v1/namespaces/${ns.metadata.name}/pods`);
          if (nsPods.items) {
            totalPods += nsPods.items.length;
            readyPods += nsPods.items.filter(p => p.status?.phase === 'Running').length;
            pendingPods += nsPods.items.filter(p => p.status?.phase === 'Pending').length;
            crashLoop += nsPods.items.filter(p => p.status?.containerStatuses?.some(c => c.state?.waiting?.reason === 'CrashLoopBackOff')).length;
          }
        }
      }

      // Get cert count
      let certReady = 0, certTotal = 0;
      try {
        const certsData = await k8sGet('/apis/cert-manager.io/v1/namespaces');
        if (certsData.items) {
          for (const ns of certsData.items) {
            const nsCerts = await k8sGet(`/apis/cert-manager.io/v1/namespaces/${ns.metadata.name}/certificates`);
            if (nsCerts.items) {
              certTotal += nsCerts.items.length;
              certReady += nsCerts.items.filter(c => (c.status?.conditions || []).find(c2 => c2.type === 'Ready' && c2.status === 'True')).length;
            }
          }
        }
      } catch {}

      return {
        namespaces: totalNs,
        pods: { total: totalPods, ready: readyPods, pending: pendingPods, crashLoop },
        certs: { ready: certReady, total: certTotal },
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      return { error: e.message };
    }
  },
};

// ---- File serve helper ----

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function serveStatic(res, reqPath) {
  // Map /css/xxx to /xxx, /js/xxx to /xxx
  let mappedPath = reqPath;
  if (reqPath.startsWith('/css/') || reqPath.startsWith('/js/')) {
    mappedPath = reqPath.slice(reqPath.indexOf('/', 1));
  }

  const filePath = path.join(STATIC_DIR, mappedPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ---- Request routing ----

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse path
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const reqPath = url.pathname;
  const method = req.method;

  // Serve static files for /, /css/*, /js/*, /favicon.svg
  if (reqPath === '/' || reqPath.startsWith('/css/') || reqPath.startsWith('/js/') || reqPath === '/favicon.svg') {
    serveStatic(res, reqPath);
    return;
  }

  // API routes
  if (reqPath.startsWith('/api/')) {
    const routeKey = `${method} ${reqPath}`;
    const route = API_ROUTES[routeKey];

    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: reqPath }));
      return;
    }

    try {
      let body = null;
      if (method === 'POST') {
        let data = '';
        for await (const chunk of req) data += chunk;
        try { body = JSON.parse(data); } catch { body = {}; }
      }

      // Extract URL params
      let params = {};
      const parts = reqPath.split('/');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith(':')) {
          params[parts[i].slice(1)] = parts[i + 1];
        }
      }

      const result = await route(body || params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin Panel API server running on port ${PORT}`);
});
