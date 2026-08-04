/* ============================================================
   BeckCloud Profile Portal — JavaScript
   Handles profile editing, password management, groups,
   sessions, tickets, security settings, and account linking.
   ============================================================ */
(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // API Helper
  // -----------------------------------------------------------------------
  async function apiFetch(endpoint, options = {}) {
    try {
      const res = await fetch(endpoint, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin', // send session cookie
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success') return data.result;
      throw new Error('API error');
    } catch (e) {
      console.error('API error:', e);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Toast
  // -----------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const existing = container.querySelectorAll('.toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(1rem)';
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // -----------------------------------------------------------------------
  // Tab Navigation
  // -----------------------------------------------------------------------
  function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active from all
        tabButtons.forEach(b => b.classList.remove('tab-btn-active'));
        tabPanels.forEach(p => p.classList.remove('tab-panel-active'));

        // Activate clicked
        btn.classList.add('tab-btn-active');
        const targetId = btn.getAttribute('data-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('tab-panel-active');
      });
    });
  }

  // -----------------------------------------------------------------------
  // Profile Section
  // -----------------------------------------------------------------------
  async function loadProfile() {
    const result = await apiFetch('/api/profile');
    if (!result) return;

    const displayName = document.getElementById('profile-display-name');
    const email = document.getElementById('profile-email');
    const bio = document.getElementById('profile-bio');
    const website = document.getElementById('profile-website');
    const location = document.getElementById('profile-location');
    const avatar = document.getElementById('avatar-display');
    const initials = document.getElementById('avatar-initials');

    if (displayName) displayName.value = result.firstName + ' ' + result.lastName;
    if (email) email.value = result.email;
    if (bio) bio.value = bio.value || '';
    if (website) website.value = website.value || '';
    if (location) location.value = location.value || '';

    if (avatar && initials) {
      const name = result.firstName || '';
      const last = result.lastName || '';
      initials.textContent = ((name[0] || '') + (last[0] || '')).toUpperCase();
    }
  }

  function initProfileSave() {
    const saveBtn = document.getElementById('profile-save-btn');
    const resetBtn = document.getElementById('profile-reset-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      const firstName = document.getElementById('profile-first-name')?.value || '';
      const lastName = document.getElementById('profile-last-name')?.value || '';
      const email = document.getElementById('profile-email')?.value || '';

      const success = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ firstName, lastName, email }),
      });

      if (success) {
        showToast('Profile updated successfully', 'success');
      } else {
        showToast('Failed to update profile', 'error');
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => loadProfile());
    }
  }

  // Avatar upload
  function initAvatarUpload() {
    const fileInput = document.getElementById('avatar-upload-input');
    const editBtn = document.getElementById('avatar-edit-btn');
    if (!fileInput || !editBtn) return;

    editBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const success = await apiFetch('/api/profile/avatar', {
          method: 'POST',
          body: JSON.stringify({ imageData: event.target.result }),
        });

        if (success) {
          showToast('Avatar uploaded', 'success');
        } else {
          showToast('Failed to upload avatar', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Export profile
  function initExportProfile() {
    const exportBtn = document.getElementById('export-profile-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', async () => {
      const profile = await apiFetch('/api/profile');
      const groups = await apiFetch('/api/profile/groups');
      const tickets = await apiFetch('/api/profile/tickets');

      if (!profile) {
        showToast('Failed to export profile', 'error');
        return;
      }

      const data = JSON.stringify({ profile, groups, tickets }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `beckcloud-profile-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Profile exported', 'success');
    });
  }

  // Deactivate/Delete account
  function initAccountActions() {
    const deactivateBtn = document.getElementById('deactivate-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', async () => {
        if (!confirm('Deactivate your account? You can reactivate by logging in again.')) return;
        const success = await apiFetch('/api/auth/logout', { method: 'POST' });
        if (success) {
          showToast('Account deactivated', 'success');
          setTimeout(() => window.location.href = '/portal', 1500);
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Permanently delete your account? This cannot be undone.')) return;
        const username = document.getElementById('profile-display-name')?.value?.split(' ')[0] || 'user';
        const success = await apiFetch(`/api/users/${username}`, { method: 'DELETE' });
        if (success) {
          showToast('Account deleted', 'success');
          setTimeout(() => window.location.href = '/', 1500);
        }
      });
    }
  }

  // -----------------------------------------------------------------------
  // Password Section
  // -----------------------------------------------------------------------
  function initPasswordSection() {
    const passwordForm = document.getElementById('password-form');
    const passwordStrength = document.getElementById('password-strength');
    const strengthLabel = document.getElementById('strength-label');

    if (!passwordForm) return;

    // Strength meter
    const strengthBars = document.querySelectorAll('.strength-bar');

    passwordForm.addEventListener('input', () => {
      const newPass = document.getElementById('password-new')?.value || '';
      const strength = calculatePasswordStrength(newPass);

      strengthBars.forEach((bar, i) => {
        bar.className = 'strength-bar';
        if (i < strength.level) {
          bar.classList.add('active-' + strength.class);
        }
      });

      if (strengthLabel) {
        strengthLabel.textContent = strength.label;
        strengthLabel.className = 'strength-label ' + strength.class;
      }
    });

    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('password-current')?.value || '';
      const newPass = document.getElementById('password-new')?.value || '';

      if (!current || !newPass) {
        showToast('Current and new password are required', 'error');
        return;
      }

      // Redirect to Keycloak for password change
      const keycloakUrl = `${window.location.origin}/realms/homelab/account/?referrer=beckcloud-web&referrer_uri=${encodeURIComponent('/profile')}`;
      window.location.href = keycloakUrl;
    });
  }

  function calculatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, class: 'weak', label: 'Weak' };
    if (score <= 2) return { level: 2, class: 'fair', label: 'Fair' };
    if (score <= 3) return { level: 3, class: 'good', label: 'Good' };
    return { level: 4, class: 'strong', label: 'Strong' };
  }

  // -----------------------------------------------------------------------
  // Groups Section
  // -----------------------------------------------------------------------
  async function loadGroups() {
    const groups = await apiFetch('/api/profile/groups');
    const container = document.getElementById('groups-list');
    if (!container) return;

    if (!groups || groups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p>No groups assigned</p>
          <small>Ask an admin to add you to a group</small>
        </div>`;
      return;
    }

    const groupIcons = {
      admins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
      '3dprinting': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    };

    const groupClasses = {
      admins: 'admin',
      media: 'media',
      '3dprinting': 'dev',
    };

    container.innerHTML = groups.map(g => `
      <div class="group-item">
        <div class="group-icon ${groupClasses[g.displayName] || ''}">
          ${groupIcons[g.displayName] || groupIcons.admins}
        </div>
        <div class="group-info">
          <div class="group-name">${g.displayName}</div>
          <div class="group-desc">${g.description || 'No description'}</div>
        </div>
        <span class="group-badge badge-active">Active</span>
      </div>
    `).join('');
  }

  function initGroupRequests() {
    const requestBtn = document.getElementById('request-groups-btn');
    if (!requestBtn) return;

    requestBtn.addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll('.request-item input[type="checkbox"]:checked');
      const selected = Array.from(checkboxes).map(cb => cb.value);

      if (selected.length === 0) {
        showToast('Select at least one group', 'error');
        return;
      }

      showToast(`Group request sent for: ${selected.join(', ')}`, 'success');
      checkboxes.forEach(cb => cb.checked = false);
    });
  }

  // -----------------------------------------------------------------------
  // Sessions Section
  // -----------------------------------------------------------------------
  async function loadSessions() {
    const sessions = await apiFetch('/api/profile/sessions');
    const container = document.getElementById('sessions-list');
    if (!container) return;

    if (!sessions) {
      container.innerHTML = '<div class="empty-state"><p>Failed to load sessions</p></div>';
      return;
    }

    const isCurrent = (id) => id === sessions.current?.id;

    const deviceIcons = {
      chrome: '🌐',
      firefox: '🦊',
      safari: '🧭',
      mobile: '📱',
      desktop: '🖥️',
    };

    const ua = sessions.current?.userAgent || 'unknown';
    let deviceType = 'desktop';
    if (/mobile|android|iphone/i.test(ua)) deviceType = 'mobile';
    else if (/chrome/i.test(ua)) deviceType = 'chrome';
    else if (/firefox/i.test(ua)) deviceType = 'firefox';
    else if (/safari/i.test(ua)) deviceType = 'safari';

    container.innerHTML = `
      <div class="session-item">
        <div class="session-icon ${isCurrent(sessions.current?.id) ? 'current' : ''}">
          ${deviceIcons[deviceType] || '🖥️'}
        </div>
        <div class="session-info">
          <div class="session-device">Current Session</div>
          <div class="session-meta">
            <span>${new Date(sessions.current?.createdAt).toLocaleString()}</span>
            <span>${sessions.current?.ip || 'unknown'}</span>
          </div>
        </div>
        <span class="session-badge current">Current</span>
        <button class="btn-revoke" onclick="revokeSession('${sessions.current?.id}')">Revoke</button>
      </div>
    `;
  }

  // Expose to global for onclick handlers
  window.revokeSession = async function (sessionId) {
    if (sessionId === 'current') {
      const success = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (success) {
        showToast('Session revoked', 'success');
        setTimeout(() => window.location.href = '/portal', 1500);
      }
    } else {
      showToast('Session revoked', 'success');
    }
  };

  // -----------------------------------------------------------------------
  // Tickets Section
  // -----------------------------------------------------------------------
  async function loadTickets() {
    const tickets = await apiFetch('/api/profile/tickets');
    const container = document.getElementById('ticket-list');
    if (!container) return;

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>No tickets yet</p>
          <small>Create a ticket to get help from the team</small>
        </div>`;
      return;
    }

    const statusDots = { open: 'open', resolved: 'resolved', closed: 'closed' };
    const tagClasses = {
      bug: 'bug', feature: 'feature', service: 'service', support: 'support',
    };

    container.innerHTML = tickets.map(t => `
      <div class="ticket-item">
        <div class="ticket-status-dot ${statusDots[t.status] || 'open'}"></div>
        <div class="ticket-info">
          <div class="ticket-title">${escapeHtml(t.title)}</div>
          <div class="ticket-desc">${escapeHtml(t.description || '')}</div>
          <div class="ticket-meta">
            <span>Created ${new Date(t.createdAt).toLocaleDateString()}</span>
            ${t.service ? `<span>Service: ${escapeHtml(t.service)}</span>` : ''}
          </div>
        </div>
        <span class="ticket-tag tag-${tagClasses[t.priority] || 'support'}">${t.priority}</span>
      </div>
    `).join('');
  }

  function initNewTicket() {
    const newTicketBtn = document.getElementById('new-ticket-btn');
    if (!newTicketBtn) return;

    newTicketBtn.addEventListener('click', () => {
      openModal('ticket-modal');
    });
  }

  function initTicketForm() {
    const ticketForm = document.getElementById('ticket-form');
    if (!ticketForm) return;

    ticketForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('ticket-title')?.value || '';
      const description = document.getElementById('ticket-desc')?.value || '';
      const service = document.getElementById('ticket-service')?.value || '';
      const priority = document.getElementById('ticket-priority')?.value || 'normal';

      if (!title || !description) {
        showToast('Title and description are required', 'error');
        return;
      }

      const result = await apiFetch('/api/profile/ticket', {
        method: 'POST',
        body: JSON.stringify({ title, description, service, priority }),
      });

      if (result) {
        showToast('Ticket created', 'success');
        closeModal('ticket-modal');
        ticketForm.reset();
        loadTickets();
      } else {
        showToast('Failed to create ticket', 'error');
      }
    });
  }

  // -----------------------------------------------------------------------
  // Account Linking
  // -----------------------------------------------------------------------
  function initAccountLinking() {
    const links = [
      { name: 'Keycloak', desc: 'Primary authentication provider', connected: true },
      { name: 'GitHub', desc: 'Connect for SSO and access', connected: false },
      { name: 'GitLab', desc: 'Connect for SSO and access', connected: false },
    ];

    const container = document.getElementById('account-links');
    if (!container) return;

    container.innerHTML = links.map(link => `
      <div class="link-item">
        <div class="link-icon ${link.connected ? 'connected' : 'disconnected'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </div>
        <div class="link-info">
          <div class="link-name">${link.name}</div>
          <div class="link-desc">${link.desc}</div>
        </div>
        <div class="link-action">
          ${link.connected
            ? '<span class="btn-connected">Connected</span>'
            : '<button class="btn-connect" onclick="connectAccount(\'' + link.name + '\')">Connect</button>'
          }
        </div>
      </div>
    `).join('');
  }

  window.connectAccount = function (name) {
    showToast(`${name} connection initiated`, 'info');
  };

  // -----------------------------------------------------------------------
  // Security Section
  // -----------------------------------------------------------------------
  async function loadSecurity() {
    const security = await apiFetch('/api/profile/security');
    if (!security) return;

    const twofaStatus = document.getElementById('twofa-status');
    const passwordLast = document.getElementById('password-last-changed');
    const failureCount = document.getElementById('login-failures');

    if (twofaStatus) {
      twofaStatus.className = 'badge ' + (security.twoFactorEnabled ? 'badge-active' : '');
      twofaStatus.textContent = security.twoFactorEnabled ? 'Enabled' : 'Disabled';
    }

    if (passwordLast) {
      passwordLast.textContent = security.passwordLastChanged
        ? new Date(security.passwordLastChanged).toLocaleDateString()
        : 'Never';
    }

    if (failureCount) {
      failureCount.textContent = security.loginFailureCount || 0;
    }
  }

  function init2FASwitch() {
    const twofaToggle = document.getElementById('twofa-toggle');
    if (!twofaToggle) return;

    twofaToggle.addEventListener('click', () => {
      showToast('2FA setup flow initiated', 'info');
    });
  }

  // -----------------------------------------------------------------------
  // Modal Helpers
  // -----------------------------------------------------------------------
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  });

  // -----------------------------------------------------------------------
  // Escape HTML
  // -----------------------------------------------------------------------
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Mobile sidebar
  // -----------------------------------------------------------------------
  function initMobileSidebar() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
  }

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/portal';
    });
  }

  // -----------------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------------
  function init() {
    initTabs();
    initMobileSidebar();
    initLogout();
    initProfileSave();
    initAvatarUpload();
    initExportProfile();
    initAccountActions();
    initPasswordSection();
    initNewTicket();
    initTicketForm();
    initAccountLinking();
    init2FASwitch();

    // Load data for each tab
    loadProfile();
    loadGroups();
    loadSessions();
    loadTickets();
    loadSecurity();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
