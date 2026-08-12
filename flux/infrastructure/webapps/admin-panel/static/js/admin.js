/* ============================================================
   BeckCloud Admin Panel — Main Script
   Handles navigation, data rendering, modals, and interactions.
   ============================================================ */

// ===== DATA =====

const SERVICES = [
  { id: 'sso', name: 'SSO Platform', url: 'auth.becklab.cloud', category: 'Identity', access: 'all' },
  { id: 'bitwarden', name: 'Password Vault', url: 'bw.becklab.cloud', category: 'Security', access: 'all' },
  { id: 'grafana', name: 'Grafana', url: 'grafana.becklab.cloud', category: 'Monitoring', access: 'admin' },
  { id: 'wazuh', name: 'Wazuh', url: 'wazuh.becklab.cloud', category: 'Security', access: 'admin' },
  { id: 'wiki', name: 'Wiki & Docs', url: 'wiki.becklab.cloud', category: 'Knowledge', access: 'all' },
  { id: 'directus', name: 'CMS (Directus)', url: 'cms.becklab.cloud', category: 'Development', access: 'admin' },
  { id: 'affine', name: 'Affine Workspace', url: 'affine.becklab.cloud', category: 'Productivity', access: 'admin' },
  { id: 'homeassistant', name: 'Home Assistant', url: 'ha.becklab.cloud', category: 'IoT', access: 'admin' },
  { id: 'jellyfin', name: 'Jellyfin', url: 'jellyfin.becklab.cloud', category: 'Media', access: 'media' },
  { id: 'swiparr', name: 'Swiparr', url: 'swiparr.becklab.cloud', category: 'Media', access: 'media' },
  { id: 'silex', name: 'Silex Editor', url: 'silex.becklab.cloud', category: 'Development', access: 'admin' },
  { id: 'nova', name: 'OpenClaw (Nova)', url: 'nova.becklab.cloud', category: 'AI', access: 'admin' },
  { id: 'manyfold', name: 'Manyfold', url: 'manyfold.becklab.cloud', category: '3D', access: '3d' },
  { id: 'fdm', name: 'FDM Monster', url: 'fdm.becklab.cloud', category: '3D', access: '3d' },
  { id: 'gridspace', name: 'Gridspace', url: 'gridspace.becklab.cloud', category: '3D', access: '3d' },
  { id: 'hash', name: 'Hash Service', url: 'hash.becklab.cloud', category: 'Micro', access: 'public' },
  { id: 'short', name: 'URL Shortener', url: 'short.becklab.cloud', category: 'Micro', access: 'public' },
  { id: 'qr', name: 'QR Generator', url: 'qr.becklab.cloud', category: 'Micro', access: 'public' },
  { id: 'static-sites', name: 'Static Sites', url: 'site.becklab.cloud', category: 'Micro', access: 'public' },
  { id: 'opennebula', name: 'OpenNebula', url: 'one.becklab.cloud', category: 'Infrastructure', access: 'opennebula' },
  { id: 'spoolman', name: 'Spoolman', url: 'spoolman.becklab.cloud', category: '3D', access: '3d' },
  { id: 'webhook', name: 'Webhook Relay', url: 'webhook.becklab.cloud', category: 'Micro', access: 'all' },
  { id: 'cron', name: 'Cron Jobs', url: 'cron.becklab.cloud', category: 'Micro', access: 'all' },
  { id: 'imgresize', name: 'Image Resize', url: 'img.becklab.cloud', category: 'Micro', access: 'all' },
  { id: 'markdown', name: 'Markdown Render', url: 'md.becklab.cloud', category: 'Micro', access: 'all' },
  { id: 'beckflow', name: 'BeckFlow', url: 'beckflow.becklab.cloud', category: 'Development', access: 'all' },
];

const ROLES = [
  { name: 'Admin', slug: 'beckcloud.admin', desc: 'Full access to all services and admin panels. Can manage users, roles, and services.', badge: 'admin' },
  { name: 'User', slug: 'beckcloud.user', desc: 'Standard access to publicly available services and core tools.', badge: 'user' },
  { name: 'Media', slug: 'beckcloud.media', desc: 'Access to Jellyfin, Swiparr, and media-related services.', badge: 'media' },
  { name: '3D Printing', slug: 'beckcloud.3dprinting', desc: 'Access to Manyfold, FDM Monster, Gridspace, and Spoolman.', badge: '3d' },
  { name: 'LLM', slug: 'beckcloud.llm', desc: 'OpenClaw (Nova) AI endpoint access.', badge: 'llm' },
  { name: 'OpenNebula', slug: 'beckcloud.opennebula', desc: 'VM hosting and management via OpenNebula.', badge: 'opennebula' },
];

const ACCESS_MATRIX = {
  'SSO Platform': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Password Vault': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Grafana': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Wazuh': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Wiki & Docs': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'CMS (Directus)': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Affine Workspace': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Home Assistant': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Jellyfin': { admin: true, user: false, media: true, '3dprinting': false, llm: false, opennebula: false },
  'Swiparr': { admin: true, user: false, media: true, '3dprinting': false, llm: false, opennebula: false },
  'Silex Editor': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'OpenClaw (Nova)': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: false },
  'Manyfold': { admin: true, user: false, media: false, '3dprinting': true, llm: false, opennebula: false },
  'FDM Monster': { admin: true, user: false, media: false, '3dprinting': true, llm: false, opennebula: false },
  'Gridspace': { admin: true, user: false, media: false, '3dprinting': true, llm: false, opennebula: false },
  'Spoolman': { admin: true, user: false, media: false, '3dprinting': true, llm: false, opennebula: false },
  'Hash Service': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'URL Shortener': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'QR Generator': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Static Sites': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'OpenNebula': { admin: true, user: false, media: false, '3dprinting': false, llm: false, opennebula: true },
  'Webhook Relay': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Cron Jobs': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Image Resize': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'Markdown Render': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
  'BeckFlow': { admin: true, user: true, media: true, '3dprinting': true, llm: true, opennebula: true },
};

let users = [
  { id: 1, name: 'Stephen Beck', email: 'stephen@becklab.cloud', role: 'admin', status: 'active', lastLogin: '2026-07-31 12:45', groups: ['admins'] },
  { id: 2, name: 'Alex Rivera', email: 'alex@becklab.cloud', role: 'user', status: 'active', lastLogin: '2026-07-30 18:22', groups: [] },
  { id: 3, name: 'Morgan Chen', email: 'morgan@becklab.cloud', role: 'media', status: 'active', lastLogin: '2026-07-31 09:15', groups: ['media'] },
  { id: 4, name: 'Jordan Blake', email: 'jordan@becklab.cloud', role: '3dprinting', status: 'active', lastLogin: '2026-07-29 14:30', groups: ['3dprinting'] },
  { id: 5, name: 'Taylor Kim', email: 'taylor@becklab.cloud', role: 'llm', status: 'active', lastLogin: '2026-07-31 11:00', groups: ['llm'] },
  { id: 6, name: 'Casey Nguyen', email: 'casey@becklab.cloud', role: 'opennebula', status: 'active', lastLogin: '2026-07-28 16:45', groups: ['opennebula'] },
  { id: 7, name: 'Riley Foster', email: 'riley@becklab.cloud', role: 'user', status: 'inactive', lastLogin: '2026-07-15 10:00', groups: [] },
  { id: 8, name: 'Drew Patel', email: 'drew@becklab.cloud', role: 'user', status: 'suspended', lastLogin: '2026-07-20 08:30', groups: [] },
  { id: 9, name: 'Sam Whitfield', email: 'sam@becklab.cloud', role: 'admin', status: 'active', lastLogin: '2026-07-31 13:10', groups: ['admins', 'opennebula'] },
  { id: 10, name: 'Jamie Torres', email: 'jamie@becklab.cloud', role: 'user', status: 'active', lastLogin: '2026-07-31 07:00', groups: [] },
];

let tickets = [
  { id: 1001, title: 'Jellyfin 403 on mobile', user: 'morgan@becklab.cloud', service: 'jellyfin', status: 'new', priority: 'normal', created: '2026-07-31 10:15', desc: 'Getting 403 when accessing Jellyfin from phone. Works on desktop.', comments: 0 },
  { id: 1002, title: 'FDM Monster slicing timeout', user: 'jordan@becklab.cloud', service: 'fdm', status: 'open', priority: 'high', created: '2026-07-31 08:30', desc: 'Large prints (>4hrs) timeout at 75% completion.', comments: 3 },
  { id: 1003, title: 'Cannot reset Bitwarden password', user: 'alex@becklab.cloud', service: 'bitwarden', status: 'open', priority: 'normal', created: '2026-07-30 16:45', desc: 'Password reset email never arrives.', comments: 1 },
  { id: 1004, title: 'Wiki page not saving', user: 'casey@becklab.cloud', service: 'wiki', status: 'pending', priority: 'low', created: '2026-07-30 11:20', desc: 'Sometimes saves blank content after editing.', comments: 2 },
  { id: 1005, title: 'Nova API slow response', user: 'taylor@becklab.cloud', service: 'nova', status: 'resolved', priority: 'high', created: '2026-07-29 14:00', desc: 'API responses averaging 12s instead of expected <2s.', comments: 5 },
  { id: 1006, title: 'Spoolman missing filament data', user: 'jordan@becklab.cloud', service: 'spoolman', status: 'closed', priority: 'normal', created: '2026-07-28 09:00', desc: 'Weight tracking not updating correctly.', comments: 4 },
  { id: 1007, title: 'OpenNebula VM won\'t start', user: 'casey@becklab.cloud', service: 'opennebula', status: 'new', priority: 'urgent', created: '2026-07-31 12:00', desc: 'vm-webapp stuck in PENDING state for 2+ hours.', comments: 1 },
  { id: 1008, title: 'Grafana dashboard loading slowly', user: 'stephen@becklab.cloud', service: 'grafana', status: 'open', priority: 'normal', created: '2026-07-31 09:45', desc: 'Dashboards take >30s to load with full time range.', comments: 2 },
];

let auditLog = [
  { time: '13:10', user: 'Sam Whitfield', action: 'Logged in', target: '', type: 'system' },
  { time: '12:45', user: 'Stephen Beck', action: 'Updated service config', target: 'directus.yaml', type: 'service' },
  { time: '12:30', user: 'Stephen Beck', action: 'Added role', target: 'beckcloud.opennebula', type: 'role' },
  { time: '11:55', user: 'Sam Whitfield', action: 'Assigned group', target: 'Sam Whitfield → admins', type: 'role' },
  { time: '11:30', user: 'Stephen Beck', action: 'Resolved ticket', target: '#1005 Nova API slow response', type: 'user' },
  { time: '11:15', user: 'taylor@becklab.cloud', action: 'Logged in', target: '', type: 'system' },
  { time: '10:45', user: 'Stephen Beck', action: 'Created user', target: 'Jamie Torres', type: 'user' },
  { time: '10:30', user: 'System', action: 'Backup completed', target: 'velero-daily-2026-07-31', type: 'system' },
  { time: '10:00', user: 'Casey Nguyen', action: 'Updated roles', target: 'vm-webapp → vm-admin', type: 'role' },
  { time: '09:30', user: 'System', action: 'Health check', target: 'All services operational', type: 'system' },
  { time: '09:00', user: 'Morgan Chen', action: 'Logged in', target: '', type: 'system' },
  { time: '08:45', user: 'Stephen Beck', action: 'Updated RBAC policy', target: 'oauth2-proxy middleware', type: 'service' },
  { time: '08:00', user: 'System', action: 'SSL cert renewed', target: 'grafana.becklab.cloud', type: 'system' },
  { time: '07:30', user: 'System', action: 'Health check', target: 'All services operational', type: 'system' },
  { time: '00:00', user: 'System', action: 'Daily backup started', target: 'velero-daily-2026-07-31', type: 'system' },
];

const QUICK_ACTIONS = [
  { icon: '👤', label: 'Add User', desc: 'Create a new user account', section: 'users', color: 'rgba(124,92,252,0.12)', actionColor: 'var(--brand-secondary)' },
  { icon: '🎫', label: 'New Ticket', desc: 'Create a trouble ticket', section: 'tickets', color: 'rgba(255,107,74,0.12)', actionColor: 'var(--brand-accent)' },
  { icon: '👥', label: 'Add Group', desc: 'Create a new role/group', section: 'groups', color: 'rgba(232,168,56,0.12)', actionColor: 'var(--brand-primary)' },
  { icon: '🔑', label: 'Reset Password', desc: 'Force password reset', section: 'users', color: 'rgba(56,189,248,0.12)', actionColor: '#38BDF8' },
  { icon: '📋', label: 'View Audit Log', desc: 'Review admin actions', section: 'audit', color: 'rgba(74,222,128,0.12)', actionColor: 'var(--status-success)' },
  { icon: '🔧', label: 'Backup Now', desc: 'Trigger velero backup', section: 'health', color: 'rgba(168,85,247,0.12)', actionColor: '#A855F7' },
  { icon: '🔄', label: 'Flush Cache', desc: 'Clear redis cache', section: 'health', color: 'rgba(251,191,36,0.12)', actionColor: '#FBBF24' },
  { icon: '📊', label: 'View Grafana', desc: 'Open Grafana dashboard', section: 'health', color: 'rgba(244,114,182,0.12)', actionColor: '#F472B6' },
  { icon: '✉️', label: 'Send Email', desc: 'Broadcast to all users', section: 'users', color: 'rgba(45,27,105,0.12)', actionColor: '#2D1B69' },
  { icon: '🛡️', label: 'SSL Certs', desc: 'Check certificate expiry', section: 'health', color: 'rgba(34,197,94,0.12)', actionColor: '#22C55E' },
  { icon: '🗄️', label: 'DB Admin', desc: 'Open Directus admin', section: 'health', color: 'rgba(56,189,248,0.12)', actionColor: '#38BDF8' },
  { icon: '⚡', label: 'Restart Proxy', desc: 'Restart oauth2-proxy', section: 'health', color: 'rgba(232,168,56,0.12)', actionColor: 'var(--brand-primary)' },
];

const SERVICE_HEALTH = {
  'sso': { status: 'healthy', uptime: '99.97%', latency: '45ms' },
  'bitwarden': { status: 'healthy', uptime: '99.95%', latency: '120ms' },
  'grafana': { status: 'degraded', uptime: '98.2%', latency: '3.2s' },
  'wazuh': { status: 'healthy', uptime: '99.99%', latency: '89ms' },
  'wiki': { status: 'healthy', uptime: '99.8%', latency: '156ms' },
  'directus': { status: 'healthy', uptime: '99.9%', latency: '200ms' },
  'affine': { status: 'healthy', uptime: '99.5%', latency: '340ms' },
  'homeassistant': { status: 'healthy', uptime: '99.99%', latency: '67ms' },
  'jellyfin': { status: 'healthy', uptime: '99.8%', latency: '210ms' },
  'swiparr': { status: 'healthy', uptime: '99.6%', latency: '180ms' },
  'silex': { status: 'healthy', uptime: '99.3%', latency: '290ms' },
  'nova': { status: 'degraded', uptime: '97.8%', latency: '1.2s' },
  'manyfold': { status: 'healthy', uptime: '99.7%', latency: '145ms' },
  'fdm': { status: 'healthy', uptime: '99.4%', latency: '450ms' },
  'gridspace': { status: 'healthy', uptime: '99.1%', latency: '320ms' },
  'opennebula': { status: 'healthy', uptime: '99.6%', latency: '180ms' },
  'hash': { status: 'healthy', uptime: '100%', latency: '12ms' },
  'short': { status: 'healthy', uptime: '100%', latency: '8ms' },
  'qr': { status: 'healthy', uptime: '100%', latency: '15ms' },
  'static-sites': { status: 'healthy', uptime: '100%', latency: '5ms' },
  'spoolman': { status: 'healthy', uptime: '99.8%', latency: '95ms' },
  'webhook': { status: 'healthy', uptime: '99.9%', latency: '22ms' },
  'cron': { status: 'healthy', uptime: '99.9%', latency: '18ms' },
  'imgresize': { status: 'healthy', uptime: '100%', latency: '35ms' },
  'markdown': { status: 'healthy', uptime: '100%', latency: '28ms' },
  'beckflow': { status: 'healthy', uptime: '99.7%', latency: '165ms' },
};

// ===== API FETCH HELPERS =====
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch('/api' + endpoint, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return { error: e.message };
  }
}

// Real service health from K8s
let realServiceHealth = null;
async function loadRealHealth() {
  try {
    const data = await apiFetch('/health/services');
    if (data && !data.error) {
      realServiceHealth = data.map(s => ({
        id: s.name.replace(/[-\s]/g, '').toLowerCase(),
        name: s.name,
        status: s.healthy ? 'healthy' : s.phase === 'no-pods' ? 'down' : 'degraded',
        ready: s.ready,
        total: s.total,
        namespace: s.namespace,
      }));
    }
  } catch (e) { console.error('Health load error:', e); }
}

// Real cert data
let realCerts = null;
async function loadRealCerts() {
  try {
    realCerts = await apiFetch('/health/certs');
  } catch (e) { console.error('Certs load error:', e); }
}

// Real Keycloak users
let realKcUsers = null;
async function loadRealKcUsers() {
  try {
    realKcUsers = await apiFetch('/users/keycloak');
  } catch (e) { console.error('KC users load error:', e); }
}

// Real backup status
let realBackups = null;
async function loadRealBackups() {
  try {
    realBackups = await apiFetch('/backup/status');
  } catch (e) { console.error('Backup load error:', e); }
}

// Real dashboard summary
let realDashboardSummary = null;
async function loadDashboardSummary() {
  try {
    realDashboardSummary = await apiFetch('/dashboard/summary');
  } catch (e) { console.error('Dashboard summary error:', e); }
}

// ===== STATE =====
let currentSection = 'dashboard';
let currentTicketFilter = 'all';
let currentAuditFilter = 'all';
let nextUserId = 11;
let nextTicketId = 1009;

// ===== NAVIGATION =====
function navigateTo(section) {
  // Update sidebar
  document.querySelectorAll('.admin-sidebar-link').forEach(link => {
    link.classList.toggle('admin-sidebar-link-active', link.dataset.section === section);
  });

  // Update sections
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.remove('admin-section-active');
  });
  const target = document.getElementById('section-' + section);
  if (target) {
    target.classList.add('admin-section-active');
  }

  currentSection = section;

  // Close mobile sidebar
  closeMobileSidebar();

  // Refresh section data
  switch (section) {
    case 'dashboard': renderDashboard(); break;
    case 'users': renderUsers(); break;
    case 'groups': renderGroups(); break;
    case 'tickets': renderTickets(); break;
    case 'audit': renderAuditLog(); break;
    case 'health': renderHealth(); break;
    case 'quick': renderQuickActions('all-quick-actions'); break;
  }
}

// Sidebar click handlers
document.querySelectorAll('.admin-sidebar-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.section);
  });
});

// Mobile sidebar
const sidebarToggle = document.getElementById('admin-sidebar-toggle');
const sidebar = document.getElementById('admin-sidebar');
const sidebarOverlay = document.getElementById('admin-sidebar-overlay');

sidebarToggle.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('open');
  sidebarToggle.setAttribute('aria-expanded', isOpen);
  sidebarOverlay.classList.toggle('open', isOpen);
});

sidebarOverlay.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
  sidebar.classList.remove('open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
  sidebarOverlay.classList.remove('open');
}

// ===== MODAL HELPERS =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(1rem)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== RENDER: DASHBOARD =====
function renderDashboard() {
  // Use real cluster data if available
  const summary = realDashboardSummary || {};
  const pods = summary.pods || {};
  const pv = summary.pv || {};
  const podTotal = pods.total || 0;
  const podReady = pods.ready || 0;
  const podPending = pods.pending || 0;
  const podCrash = pods.crashLoop || 0;
  const pvTotal = pv.total || 0;
  const pvBound = pv.bound || 0;
  const namespaces = summary.namespaces || 0;

  // Use real pod health if available
  const realHealthCount = realServiceHealth ? realServiceHealth.filter(s => s.status === 'healthy').length : Object.values(SERVICE_HEALTH).filter(s => s.status === 'healthy').length;
  const realHealthTotal = realServiceHealth ? realServiceHealth.length : SERVICES.length;
  const healthyDegraded = (realServiceHealth ? realServiceHealth.filter(s => s.status !== 'healthy').length : Object.keys(SERVICE_HEALTH).length - realHealthCount);

  const statsContainer = document.getElementById('dashboard-stats');
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Pods</span>
        <div class="stat-card-icon services">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </div>
      </div>
      <div class="stat-card-value">${podReady}/${podTotal}</div>
      <div class="stat-card-trend">${podPending} pending${podCrash > 0 ? ', ' + podCrash + ' crash' : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Namespaces</span>
        <div class="stat-card-icon users">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
      </div>
      <div class="stat-card-value">${namespaces}</div>
      <div class="stat-card-trend">active</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Services Healthy</span>
        <div class="stat-card-icon services">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
      </div>
      <div class="stat-card-value">${realHealthCount}/${realHealthTotal}</div>
      <div class="stat-card-trend">${healthyDegraded > 0 ? healthyDegraded + ' degraded' : 'all good'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">PVs Bound</span>
        <div class="stat-card-icon tickets">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
      </div>
      <div class="stat-card-value">${pvBound}/${pvTotal}</div>
      <div class="stat-card-trend">${pvTotal - pvBound > 0 ? (pvTotal - pvBound) + ' unbound' : 'all bound'}</div>
    </div>
  `;

  // Quick actions
  renderQuickActions('quick-actions-grid');

  // Recent activity
  const recentContainer = document.getElementById('recent-activity');
  recentContainer.innerHTML = auditLog.slice(0, 8).map(entry => `
    <div class="audit-entry">
      <span class="audit-entry-time">${entry.time}</span>
      <span class="audit-entry-user">${entry.user}</span>
      <span class="audit-entry-action">${entry.action}</span>
      ${entry.target ? `<span class="audit-entry-target">→ ${entry.target}</span>` : ''}
    </div>
  `).join('');

  // Dashboard health (first 8)
  renderHealthGrid('dashboard-health', 8);
}

function renderQuickActions(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = QUICK_ACTIONS.map(action => `
    <button class="quick-action-btn" onclick="handleQuickAction('${action.section}', '${action.label}')">
      <div class="quick-action-icon" style="background:${action.color}; color:${action.actionColor}">${action.icon}</div>
      <span class="quick-action-label">${action.label}</span>
      <span class="quick-action-desc">${action.desc}</span>
    </button>
  `).join('');
}

function handleQuickAction(section, label) {
  switch (label) {
    case 'Add User': openUserModal(); break;
    case 'New Ticket': openTicketModal(); break;
    case 'Add Group': openGroupModal(); break;
    case 'Reset Password':
      navigateTo('users');
      setTimeout(() => showToast('Password reset flow initiated', 'success'), 300);
      break;
    case 'View Audit Log': navigateTo('audit'); break;
    case 'Backup Now':
      showToast('Velero backup triggered', 'success');
      auditLog.unshift({ time: new Date().toTimeString().slice(0,5), user: 'Stephen Beck', action: 'Triggered backup', target: 'velero-manual-' + new Date().toISOString().slice(0,10), type: 'system' });
      break;
    case 'Flush Cache':
      showToast('Redis cache flushed', 'success');
      break;
    case 'View Grafana':
      window.open('https://grafana.becklab.cloud', '_blank');
      break;
    case 'SSL Certs':
      showToast('All certs valid. Next renewal: 2026-10-15', 'info');
      break;
    case 'DB Admin':
      window.open('https://cms.becklab.cloud', '_blank');
      break;
    case 'Restart Proxy':
      showToast('oauth2-proxy restart initiated', 'info');
      break;
    case 'Send Email':
      showToast('Email composer opened', 'info');
      break;
    default:
      navigateTo(section);
  }
}

// ===== RENDER: USERS =====
function renderUsers() {
  const tbody = document.getElementById('users-table-body');
  const search = document.getElementById('user-search')?.value?.toLowerCase() || '';

  let filtered = users;
  if (search) {
    filtered = filtered.filter(u =>
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No users found.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(user => {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const roleBadge = getRoleBadge(user.role);
    const statusBadge = getStatusBadge(user.status);
    const lastLogin = user.lastLogin ? formatRelativeTime(user.lastLogin) : 'Never';

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-cell-avatar">${initials}</div>
            <div class="user-cell-info">
              <div class="user-cell-name">${escapeHtml(user.name)}</div>
              <div class="user-cell-email">${escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td style="color:var(--text-secondary); font-size:0.8125rem;">${lastLogin}</td>
        <td>
          <div style="display:flex; gap:0.375rem;">
            <button class="btn btn-secondary btn-sm" onclick="editUser(${user.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers() {
  renderUsers();
}

function getRoleBadge(role) {
  const badges = {
    admin: '<span class="badge badge-admin">Admin</span>',
    user: '<span class="badge badge-user">User</span>',
    media: '<span class="badge badge-media">Media</span>',
    '3dprinting': '<span class="badge badge-3d">3D</span>',
    llm: '<span class="badge badge-llm">LLM</span>',
    opennebula: '<span class="badge badge-opennebula">ONE</span>',
  };
  return badges[role] || '<span class="badge badge-user">User</span>';
}

function getStatusBadge(status) {
  const badges = {
    active: '<span class="badge badge-active">Active</span>',
    inactive: '<span class="badge badge-inactive">Inactive</span>',
    suspended: '<span class="badge badge-suspended">Suspended</span>',
  };
  return badges[status] || '<span class="badge badge-inactive">Unknown</span>';
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

// ===== USER MODAL =====
function openUserModal(userId = null) {
  document.getElementById('user-edit-id').value = '';
  document.getElementById('user-form-name').value = '';
  document.getElementById('user-form-email').value = '';
  document.getElementById('user-form-password').value = '';
  document.getElementById('user-form-role').value = 'beckcloud.user';
  document.getElementById('user-form-status').value = 'active';
  document.getElementById('user-modal-title').textContent = 'Add User';

  // Reset checkboxes
  document.querySelectorAll('#user-form-groups input[type="checkbox"]').forEach(cb => cb.checked = false);

  if (userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
      document.getElementById('user-edit-id').value = user.id;
      document.getElementById('user-form-name').value = user.name;
      document.getElementById('user-form-email').value = user.email;
      document.getElementById('user-form-role').value = 'beckcloud.' + user.role;
      document.getElementById('user-form-status').value = user.status;
      document.getElementById('user-modal-title').textContent = 'Edit User';

      document.querySelectorAll('#user-form-groups input[type="checkbox"]').forEach(cb => {
        cb.checked = user.groups.includes(cb.value);
      });
    }
  }

  openModal('user-modal');
}

function editUser(id) {
  openUserModal(id);
}

function saveUser() {
  const name = document.getElementById('user-form-name').value.trim();
  const email = document.getElementById('user-form-email').value.trim();
  const role = document.getElementById('user-form-role').value.replace('beckcloud.', '');
  const status = document.getElementById('user-form-status').value;
  const groups = [];
  document.querySelectorAll('#user-form-groups input[type="checkbox"]:checked').forEach(cb => groups.push(cb.value));

  if (!name || !email) {
    showToast('Name and email are required.', 'error');
    return;
  }

  const editId = document.getElementById('user-edit-id').value;
  if (editId) {
    // Edit existing
    const user = users.find(u => u.id === parseInt(editId));
    if (user) {
      user.name = name;
      user.email = email;
      user.role = role;
      user.status = status;
      user.groups = groups;
      showToast(`User "${name}" updated.`, 'success');
    }
  } else {
    // Create new
    users.push({
      id: nextUserId++,
      name,
      email,
      role,
      status,
      lastLogin: null,
      groups,
    });
    showToast(`User "${name}" created.`, 'success');
    auditLog.unshift({ time: new Date().toTimeString().slice(0,5), user: 'Stephen Beck', action: 'Created user', target: name, type: 'user' });
  }

  closeModal('user-modal');
  renderUsers();
}

function deleteUser(id) {
  const user = users.find(u => u.id === id);
  if (!user) return;
  if (!confirm(`Delete user "${user.name}"?`)) return;
  users = users.filter(u => u.id !== id);
  showToast(`User "${user.name}" deleted.`, 'success');
  auditLog.unshift({ time: new Date().toTimeString().slice(0,5), user: 'Stephen Beck', action: 'Deleted user', target: user.name, type: 'user' });
  renderUsers();
}

// ===== FILTER MODAL =====
function openFilterModal() {
  openModal('filter-modal');
}

function applyFilters() {
  closeModal('filter-modal');
  showToast('Filters applied', 'info');
  renderUsers();
}

// ===== RENDER: GROUPS =====
function renderGroups() {
  // Role cards
  const roleCards = document.getElementById('role-cards');
  roleCards.innerHTML = ROLES.map(role => {
    const userCount = users.filter(u => u.role === role.slug.split('.')[1] || u.role === role.slug.split('beckcloud.')[1]).length;
    return `
      <div class="service-health-card">
        <div class="service-health-icon" style="background:rgba(124,92,252,0.12); color:var(--brand-secondary); font-size:0.75rem;">
          ${role.slug.split('.')[1].toUpperCase().slice(0,4)}
        </div>
        <div class="service-health-info">
          <div class="service-health-name">${role.name}</div>
          <div class="service-health-url">${role.slug} · ${userCount} assigned</div>
        </div>
        <div class="service-health-status">${getRoleBadge(role.slug.split('beckcloud.')[1])}</div>
      </div>
    `;
  }).join('');

  // Access matrix
  const matrixBody = document.getElementById('access-matrix-body');
  const roles = ['admin', 'user', 'media', '3dprinting', 'llm', 'opennebula'];
  const roleLabels = { admin: 'Admin', user: 'User', media: 'Media', '3dprinting': '3D', llm: 'LLM', opennebula: 'ONE' };

  matrixBody.innerHTML = Object.entries(ACCESS_MATRIX).map(([service, access]) => `
    <tr>
      <td>${escapeHtml(service)}</td>
      ${roles.map(r => `
        <td>${access[r] ? '<span class="matrix-check">✓</span>' : '<span class="matrix-cross">✕</span>'}</td>
      `).join('')}
    </tr>
  `).join('');
}

// ===== GROUP MODAL =====
function openGroupModal() {
  document.getElementById('group-form-name').value = '';
  document.getElementById('group-form-slug').value = '';

  // Populate service checkboxes
  const container = document.getElementById('group-form-services');
  container.innerHTML = SERVICES.filter(s => s.access !== 'public').map(s => `
    <label class="checkbox-item"><input type="checkbox" value="${s.id}"> ${s.name}</label>
  `).join('');

  openModal('group-modal');
}

function saveGroup() {
  const name = document.getElementById('group-form-name').value.trim();
  const slug = document.getElementById('group-form-slug').value.trim();
  if (!name || !slug) {
    showToast('Name and slug are required.', 'error');
    return;
  }

  showToast(`Role "${name}" (${slug}) created.`, 'success');
  auditLog.unshift({ time: new Date().toTimeString().slice(0,5), user: 'Stephen Beck', action: 'Created role', target: slug, type: 'role' });
  closeModal('group-modal');
  renderGroups();
}

// ===== RENDER: TICKETS =====
function renderTickets() {
  const container = document.getElementById('ticket-list');

  let filtered = tickets;
  if (currentTicketFilter !== 'all') {
    filtered = tickets.filter(t => t.status === currentTicketFilter);
  }

  // Sort: new > open > pending > resolved > closed
  const statusOrder = { new: 0, open: 1, pending: 2, resolved: 3, closed: 4 };
  filtered.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>No tickets match this filter</h3><p>Try a different status filter or create a new ticket.</p></div>`;
    return;
  }

  const priorityBadge = (p) => {
    const colors = { low: 'var(--text-tertiary)', normal: 'var(--brand-secondary)', high: '#FBBF24', urgent: 'var(--brand-accent)' };
    return `<span style="color:${colors[p]}; font-size:0.6875rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${p}</span>`;
  };

  container.innerHTML = filtered.map(ticket => `
    <div class="audit-entry" style="cursor:pointer;" onclick="viewTicket(${ticket.id})">
      <div style="display:flex; align-items:center; gap:0.75rem; flex:1;">
        <div style="flex-shrink:0;">
          <span class="badge badge-${ticket.status}">${ticket.status}</span>
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:var(--text-primary); font-size:0.875rem;">#${ticket.id}: ${escapeHtml(ticket.title)}</div>
          <div style="font-size:0.75rem; color:var(--text-tertiary); margin-top:0.125rem;">
            ${escapeHtml(ticket.user)} · ${ticket.service} · ${priorityBadge(ticket.priority)} · ${ticket.created}
          </div>
        </div>
        <div style="flex-shrink:0; color:var(--text-tertiary); font-size:0.75rem;">
          ${ticket.comments} comment${ticket.comments !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function filterTickets(filter) {
  currentTicketFilter = filter;
  // Update tab styles
  document.querySelectorAll('#ticket-tabs .admin-tab').forEach(tab => {
    tab.classList.toggle('admin-tab-active', tab.dataset.ticketFilter === filter);
  });
  renderTickets();
}

function viewTicket(id) {
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return;
  showToast(`Ticket #${ticket.id}: ${ticket.title}`, 'info');
}

// ===== TICKET MODAL =====
function openTicketModal() {
  document.getElementById('ticket-form').reset();
  openModal('ticket-modal');
}

function saveTicket() {
  const title = document.getElementById('ticket-form-title').value.trim();
  const user = document.getElementById('ticket-form-user').value.trim();
  const service = document.getElementById('ticket-form-service').value;
  const priority = document.getElementById('ticket-form-priority').value;
  const desc = document.getElementById('ticket-form-desc').value.trim();

  if (!title || !desc) {
    showToast('Subject and description are required.', 'error');
    return;
  }

  const now = new Date();
  const timeStr = now.toISOString().slice(0, 16).replace('T', ' ');

  tickets.unshift({
    id: nextTicketId++,
    title,
    user: user || 'system',
    service: service || 'other',
    status: 'new',
    priority,
    created: timeStr,
    desc,
    comments: 0,
  });

  showToast(`Ticket #${nextTicketId - 1} created.`, 'success');
  auditLog.unshift({ time: now.toTimeString().slice(0, 5), user: 'Stephen Beck', action: 'Created ticket', target: `#${nextTicketId - 1}: ${title}`, type: 'user' });

  closeModal('ticket-modal');
  renderTickets();
}

// ===== RENDER: AUDIT LOG =====
function renderAuditLog() {
  const container = document.getElementById('audit-log');
  const search = document.getElementById('audit-search')?.value?.toLowerCase() || '';

  let filtered = auditLog;
  if (currentAuditFilter !== 'all') {
    filtered = filtered.filter(a => a.type === currentAuditFilter);
  }
  if (search) {
    filtered = filtered.filter(a =>
      a.user.toLowerCase().includes(search) ||
      a.action.toLowerCase().includes(search) ||
      (a.target && a.target.toLowerCase().includes(search))
    );
  }

  container.innerHTML = filtered.map(entry => `
    <div class="audit-entry">
      <span class="audit-entry-time">${entry.time}</span>
      <span class="audit-entry-user">${escapeHtml(entry.user)}</span>
      <span class="audit-entry-action">${entry.action}</span>
      ${entry.target ? `<span class="audit-entry-target">→ ${escapeHtml(entry.target)}</span>` : ''}
    </div>
  `).join('');

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No audit entries match your filters.</div>`;
  }
}

function filterAuditLog() {
  const typeFilter = document.getElementById('audit-type-filter')?.value || 'all';
  currentAuditFilter = typeFilter;
  renderAuditLog();
}

// ===== RENDER: HEALTH =====
function renderHealth() {
  // Use real pod health if available
  const healthData = realServiceHealth || Object.keys(SERVICE_HEALTH).map(id => ({
    id, name: SERVICES.find(s => s.id === id)?.name || id,
    status: SERVICE_HEALTH[id].status, ready: 1, total: 1, namespace: 'unknown',
  }));

  const healthyCount = healthData.filter(s => s.status === 'healthy').length;
  const degradedCount = healthData.filter(s => s.status === 'degraded').length;
  const downCount = healthData.filter(s => s.status === 'down').length;
  const totalCount = healthData.length;

  const sourceLabel = realServiceHealth ? 'Kubernetes pods' : 'Simulated';

  document.getElementById('health-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Healthy</span>
        <div class="stat-card-icon" style="background:rgba(74,222,128,0.12); color:var(--status-success);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 3.1"/></svg>
        </div>
      </div>
      <div class="stat-card-value" style="color:var(--status-success);">${healthyCount}</div>
      <div class="stat-card-trend up">All systems nominal</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Degraded</span>
        <div class="stat-card-icon" style="background:rgba(251,191,36,0.12); color:#FBBF24;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
      </div>
      <div class="stat-card-value" style="color:#FBBF24;">${degradedCount}</div>
      <div class="stat-card-trend">Needs investigation</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Down</span>
        <div class="stat-card-icon" style="background:rgba(255,107,74,0.12); color:var(--brand-accent);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
      </div>
      <div class="stat-card-value" style="color:var(--brand-accent);">${downCount}</div>
      <div class="stat-card-trend">Requires action</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-card-label">Total Services</span>
        <div class="stat-card-icon services">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
      </div>
      <div class="stat-card-value">${totalCount}</div>
      <div class="stat-card-trend">Running (${sourceLabel})</div>
    </div>
  `;

  renderHealthGrid('full-health-grid');
}

function renderHealthGrid(containerId, limit = Infinity) {
  const container = document.getElementById(containerId);
  // Use real pod health if available, else fallback to SERVICES
  const healthData = realServiceHealth || SERVICES.map(s => ({
    id: s.id, name: s.name, status: SERVICE_HEALTH[s.id]?.status || 'healthy',
    ready: SERVICE_HEALTH[s.id]?.ready || 1, total: SERVICE_HEALTH[s.id]?.total || 1,
    namespace: 'unknown', url: s.url,
  }));

  const limitedServices = limit > 0 ? healthData.slice(0, limit) : healthData;

  container.innerHTML = limitedServices.map(svc => {
    const statusDot = svc.status === 'healthy' ? 'success' : svc.status === 'degraded' ? 'warning' : 'danger';
    const statusLabel = svc.status.charAt(0).toUpperCase() + svc.status.slice(1);
    const podInfo = svc.total && svc.ready ? `<div style="font-size:0.65rem; color:var(--text-quaternary);">${svc.ready}/${svc.total} ready</div>` : '';
    const nsInfo = svc.namespace && svc.namespace !== 'unknown' ? `<div style="font-size:0.625rem; color:var(--text-tertiary);">${svc.namespace}</div>` : '';
    const urlInfo = svc.url ? `<div style="font-size:0.625rem; color:var(--text-tertiary);">${svc.url}</div>` : nsInfo;
    return `
      <div class="service-health-card">
        <div class="service-health-icon">${svc.name.slice(0, 2).toUpperCase()}</div>
        <div class="service-health-info">
          <div class="service-health-name">${escapeHtml(svc.name)}</div>
          ${urlInfo}
          ${podInfo}
        </div>
        <div class="service-health-status">
          <div><span class="status-dot ${statusDot}"></span></div>
          <div style="font-size:0.6875rem; color:var(--text-tertiary); margin-top:0.25rem;">${statusLabel}</div>
        </div>
      </div>
    `;
  }).join('');
}

function refreshHealth() {
  showToast('Health data refreshed.', 'success');
  // Simulate slight latency change
  SERVICES.forEach(s => {
    const current = SERVICE_HEALTH[s.id];
    if (current) {
      const newLatency = Math.floor(Math.random() * 500) + 5;
      current.latency = newLatency < 100 ? `${newLatency}ms` : `${(newLatency / 1000).toFixed(1)}s`;
    }
  });
  renderHealth();
}

// ===== INIT =====
async function init() {
  await Promise.allSettled([
    loadDashboardSummary(),
    loadRealHealth(),
    loadRealCerts(),
    loadRealKcUsers(),
  ]);
  renderDashboard();
}

// ===== HELPERS =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Keyboard shortcut: Escape closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
});

// Start
init();
