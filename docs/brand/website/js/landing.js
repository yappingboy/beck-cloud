/* ============================================================
   BeckCloud Landing Page — JavaScript
   Handles service catalog display, search, feature tabs,
   CTA flows, and performance optimizations.
   ============================================================ */
(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Service Catalog Data
  // -----------------------------------------------------------------------
  const SERVICES = [
    // Security & Identity
    { id: 'sso', name: 'SSO Platform', url: 'https://auth.becklab.cloud', category: 'Security & Identity', icon: '🔐', description: 'Unified identity management with Keycloak. Single sign-on across every service.' },
    { id: 'vault', name: 'Password Vault', url: 'https://bw.becklab.cloud', category: 'Security & Identity', icon: '🔑', description: 'Self-hosted Bitwarden. Encrypted password storage, zero third-party servers.' },
    { id: 'wazuh', name: 'Wazuh Security', url: 'https://wazuh.becklab.cloud', category: 'Security & Identity', icon: '🛡️', description: 'Security monitoring, intrusion detection, and log analysis.' },

    // Monitoring
    { id: 'grafana', name: 'Grafana Dashboards', url: 'https://grafana.becklab.cloud', category: 'Monitoring', icon: '📊', description: 'Infrastructure metrics, service health, and system performance dashboards.' },
    { id: 'prometheus', name: 'Prometheus', url: 'https://prometheus.becklab.cloud', category: 'Monitoring', icon: '🔥', description: 'Metrics collection and alerting. Powers the Grafana dashboards.' },

    // Development
    { id: 'wiki', name: 'Wiki & Docs', url: 'https://wiki.becklab.cloud', category: 'Development', icon: '📖', description: 'Self-hosted knowledge base and documentation platform.' },
    { id: 'cms', name: 'CMS Platform', url: 'https://cms.becklab.cloud', category: 'Development', icon: '✏️', description: 'Headless content management. API-first, fully self-hosted.' },
    { id: 'affine', name: 'Affine Workspace', url: 'https://affine.becklab.cloud', category: 'Development', icon: '🧩', description: 'All-in-one workspace for notes, docs, and project management.' },
    { id: 'silex', name: 'Silex Editor', url: 'https://silex.becklab.cloud', category: 'Development', icon: '🎨', description: 'Visual website builder. No code required.' },

    // Media
    { id: 'jellyfin', name: 'Jellyfin Media', url: 'https://jellyfin.becklab.cloud', category: 'Media', icon: '🎬', description: 'Free software media streaming. Movies, shows, music.' },
    { id: 'swiparr', name: 'Swiparr', url: 'https://swiparr.becklab.cloud', category: 'Media', icon: '🎵', description: 'Music discovery and streaming service.' },

    // 3D Printing
    { id: 'manyfold', name: 'Manyfold', url: 'https://manyfold.becklab.cloud', category: '3D Printing', icon: '🧊', description: 'Self-hosted 3D model library and asset manager.' },
    { id: 'fdm', name: 'FDM Monster', url: 'https://fdm.becklab.cloud', category: '3D Printing', icon: '🖨️', description: 'Cloud slicing for FDM printers. Slice in the browser.' },
    { id: 'gridspace', name: 'Gridspace', url: 'https://gridspace.becklab.cloud', category: '3D Printing', icon: '📐', description: '3D design and modeling in your browser.' },

    // Micro Services
    { id: 'hash', name: 'Hash Service', url: 'https://hash.becklab.cloud', category: 'Micro Services', icon: '#️⃣', description: 'Generate MD5, SHA1, SHA256 hashes instantly.' },
    { id: 'shortener', name: 'URL Shortener', url: 'https://short.becklab.cloud', category: 'Micro Services', icon: '🔗', description: 'Shorten URLs for sharing. No tracking.' },
    { id: 'qr', name: 'QR Generator', url: 'https://qr.becklab.cloud', category: 'Micro Services', icon: '📱', description: 'Generate QR codes for URLs, text, and more.' },
    { id: 'static', name: 'Static Sites', url: 'https://site.becklab.cloud', category: 'Micro Services', icon: '🌐', description: 'Host static websites. Just push and go.' },
    { id: 'cron', name: 'Cron Jobs', url: 'https://cron.becklab.cloud', category: 'Micro Services', icon: '⏰', description: 'Scheduled tasks and automated jobs.' },
    { id: 'image-resize', name: 'Image Resize', url: 'https://resize.becklab.cloud', category: 'Micro Services', icon: '🖼️', description: 'Resize, crop, and convert images on the fly.' },
    { id: 'markdown', name: 'Markdown Renderer', url: 'https://md.becklab.cloud', category: 'Micro Services', icon: '📝', description: 'Render Markdown to HTML instantly.' },

    // Infrastructure
    { id: 'opennebula', name: 'OpenNebula', url: 'https://one.becklab.cloud', category: 'Infrastructure', icon: '☁️', description: 'VM hosting, management, and cloud orchestration.' },
    { id: 'homeassistant', name: 'Home Assistant', url: 'https://ha.becklab.cloud', category: 'Infrastructure', icon: '🏠', description: 'Smart home automation platform.' },
    { id: 'beckflow', name: 'BeckFlow', url: 'https://beckflow.becklab.cloud', category: 'Infrastructure', icon: '⚡', description: 'Workflow automation. Connect services, automate tasks.' },
  ];

  // -----------------------------------------------------------------------
  // Feature Tabs
  // -----------------------------------------------------------------------
  function initFeatureTabs() {
    const tabButtons = document.querySelectorAll('.feature-tab-btn');
    const tabPanels = document.querySelectorAll('.feature-tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');

        // Remove active from all
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        // Activate clicked
        btn.classList.add('active');
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });
  }

  // -----------------------------------------------------------------------
  // Service Catalog Search & Filter
  // -----------------------------------------------------------------------
  function initServiceCatalog() {
    const searchInput = document.getElementById('catalog-search');
    const categoryChips = document.getElementById('category-chips');
    const serviceGrid = document.getElementById('service-catalog-grid');
    const noResults = document.getElementById('catalog-no-results');

    if (!searchInput || !serviceGrid) return;

    let activeCategory = 'all';

    // Render category chips
    if (categoryChips) {
      const categories = [...new Set(SERVICES.map(s => s.category))].sort();
      categoryChips.innerHTML = `
        <button class="filter-chip active" data-category="all">All Services</button>
        ${categories.map(cat => `<button class="filter-chip" data-category="${cat}">${cat}</button>`).join('')}
      `;

      categoryChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        categoryChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.dataset.category;
        renderCatalog(searchInput.value.trim());
      });
    }

    // Search input
    searchInput.addEventListener('input', () => {
      renderCatalog(searchInput.value.trim());
    });

    // Initial render
    renderCatalog('');

    function renderCatalog(searchTerm) {
      const filtered = SERVICES.filter(s => {
        const matchesSearch = !searchTerm ||
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
        return matchesSearch && matchesCategory;
      });

      if (filtered.length === 0) {
        serviceGrid.innerHTML = '';
        if (noResults) noResults.style.display = 'flex';
        return;
      }

      if (noResults) noResults.style.display = 'none';

      serviceGrid.innerHTML = filtered.map(s => `
        <a href="${s.url}" class="service-card" target="_blank" rel="noopener">
          <div class="service-card-icon">${s.icon}</div>
          <div class="service-card-info">
            <div class="service-card-name">${s.name}</div>
            <div class="service-card-desc">${s.description}</div>
            <div class="service-card-category">${s.category}</div>
          </div>
          <svg class="service-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </a>
      `).join('');
    }
  }

  // -----------------------------------------------------------------------
  // Navbar scroll effect
  // -----------------------------------------------------------------------
  function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 100) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // -----------------------------------------------------------------------
  // Smooth scroll for anchor links
  // -----------------------------------------------------------------------
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // CTA button animations
  // -----------------------------------------------------------------------
  function initCTAAnimations() {
    const ctaButtons = document.querySelectorAll('.btn-cta');
    ctaButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // -----------------------------------------------------------------------
  // Mobile menu toggle
  // -----------------------------------------------------------------------
  function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('navbar');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      nav.classList.toggle('mobile-open');
    });
  }

  // -----------------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------------
  function init() {
    initFeatureTabs();
    initServiceCatalog();
    initNavbarScroll();
    initSmoothScroll();
    initCTAAnimations();
    initMobileMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
