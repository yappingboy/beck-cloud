/* BeckCloud Portal — Authenticated Dashboard JS
 * Login simulation, permission-based filtering, service search, dynamic rendering.
 * No dependencies. No tracking.
 */
(function () {
  "use strict";

  /* ============================================================
     SERVICE DATA
     Complete catalog of all 20+ services with metadata.
     ============================================================ */
  var SERVICES = [
    // Security & Identity
    { id: "sso", name: "SSO Platform", url: "https://auth.becklab.cloud", category: "Security & Identity", group: "all", icon: "🔐", description: "Unified identity management with Keycloak. Single sign-on across every service." },
    { id: "vault", name: "Password Vault", url: "https://bw.becklab.cloud", category: "Security & Identity", group: "all", icon: "🔑", description: "Self-hosted Bitwarden. Encrypted password storage, zero third-party servers." },
    { id: "wazuh", name: "Wazuh Security", url: "https://wazuh.becklab.cloud", category: "Security & Identity", group: "admin", icon: "🛡️", description: "Security monitoring, intrusion detection, and log analysis." },

    // Monitoring
    { id: "grafana", name: "Grafana Dashboards", url: "https://grafana.becklab.cloud", category: "Monitoring", group: "admin", icon: "📊", description: "Infrastructure metrics, service health, and system performance dashboards." },
    { id: "prometheus", name: "Prometheus", url: "https://prometheus.becklab.cloud", category: "Monitoring", group: "admin", icon: "🔥", description: "Metrics collection and alerting. Powers the Grafana dashboards." },

    // Development
    { id: "wiki", name: "Wiki & Docs", url: "https://wiki.becklab.cloud", category: "Development", group: "all", icon: "📖", description: "Self-hosted knowledge base and documentation platform." },
    { id: "cms", name: "CMS Platform", url: "https://cms.becklab.cloud", category: "Development", group: "admin", icon: "✏️", description: "Headless content management. API-first, fully self-hosted." },
    { id: "affine", name: "Affine Workspace", url: "https://affine.becklab.cloud", category: "Development", group: "admin", icon: "🧩", description: "All-in-one workspace for notes, docs, and project management." },
    { id: "silex", name: "Silex Editor", url: "https://silex.becklab.cloud", category: "Development", group: "admin", icon: "🎨", description: "Visual website builder. No code required." },

    // Media
    { id: "jellyfin", name: "Jellyfin Media", url: "https://jellyfin.becklab.cloud", category: "Media", group: "media", icon: "🎬", description: "Free software media streaming. Movies, shows, music." },
    { id: "swiparr", name: "Swiparr", url: "https://swiparr.becklab.cloud", category: "Media", group: "media", icon: "🎵", description: "Music discovery and streaming service." },

    // 3D Printing
    { id: "manyfold", name: "Manyfold", url: "https://manyfold.becklab.cloud", category: "3D Printing", group: "3dprinting", icon: "🧊", description: "Self-hosted 3D model library and asset manager." },
    { id: "fdm", name: "FDM Monster", url: "https://fdm.becklab.cloud", category: "3D Printing", group: "3dprinting", icon: "🖨️", description: "Cloud slicing for FDM printers. Slice in the browser." },
    { id: "gridspace", name: "Gridspace", url: "https://gridspace.becklab.cloud", category: "3D Printing", group: "3dprinting", icon: "📐", description: "3D design and modeling in your browser." },

    // Micro Services
    { id: "hash", name: "Hash Service", url: "https://hash.becklab.cloud", category: "Micro Services", group: "public", icon: "#️⃣", description: "Generate MD5, SHA1, SHA256 hashes instantly." },
    { id: "shortener", name: "URL Shortener", url: "https://short.becklab.cloud", category: "Micro Services", group: "public", icon: "🔗", description: "Shorten URLs for sharing. No tracking." },
    { id: "qr", name: "QR Generator", url: "https://qr.becklab.cloud", category: "Micro Services", group: "public", icon: "📱", description: "Generate QR codes for URLs, text, and more." },
    { id: "static", name: "Static Sites", url: "https://site.becklab.cloud", category: "Micro Services", group: "public", icon: "🌐", description: "Host static websites. Just push and go." },
    { id: "cron", name: "Cron Jobs", url: "https://cron.becklab.cloud", category: "Micro Services", group: "all", icon: "⏰", description: "Scheduled tasks and automated jobs." },
    { id: "image-resize", name: "Image Resize", url: "https://resize.becklab.cloud", category: "Micro Services", group: "all", icon: "🖼️", description: "Resize, crop, and convert images on the fly." },
    { id: "markdown", name: "Markdown Renderer", url: "https://md.becklab.cloud", category: "Micro Services", group: "all", icon: "📝", description: "Render Markdown to HTML instantly." },
    { id: "yaml", name: "YAML Tools", url: "https://yaml.becklab.cloud", category: "Micro Services", group: "all", icon: "🔧", description: "Validate, format, and convert YAML files." },

    // Infrastructure
    { id: "opennebula", name: "OpenNebula", url: "https://one.becklab.cloud", category: "Infrastructure", group: "admin", icon: "☁️", description: "VM hosting, management, and cloud orchestration." },
    { id: "homeassistant", name: "Home Assistant", url: "https://ha.becklab.cloud", category: "Infrastructure", group: "admin", icon: "🏠", description: "Smart home automation platform." },
    { id: "beckflow", name: "BeckFlow", url: "https://beckflow.becklab.cloud", category: "Infrastructure", group: "all", icon: "⚡", description: "Workflow automation. Connect services, automate tasks." },
  ];

  /* ============================================================
     SERVICE STATUS (simulated)
     ============================================================ */
  var SERVICE_STATUS = {};
  SERVICES.forEach(function (s) {
    // Simulate: 85% running, 10% pending, 5% error
    var rand = Math.random();
    if (rand < 0.85) {
      SERVICE_STATUS[s.id] = { state: "running", uptime: (95 + Math.random() * 4.99).toFixed(1) + "%" };
    } else if (rand < 0.95) {
      SERVICE_STATUS[s.id] = { state: "pending", uptime: null };
    } else {
      SERVICE_STATUS[s.id] = { state: "error", uptime: null };
    }
  });

  /* ============================================================
     USER SIMULATION
     ============================================================ */
  var USERS = [
    { id: "admin", name: "Stephen Beck", email: "stephen@becklab.cloud", tier: "Admin", groups: ["all", "admin", "media", "3dprinting", "llm"], role: "Operator" },
    { id: "media", name: "Alex Rivera", email: "alex@becklab.cloud", tier: "Pro", groups: ["all", "media"], role: "Member" },
    { id: "3d", name: "Jordan Chen", email: "jordan@becklab.cloud", tier: "Builder", groups: ["all", "3dprinting"], role: "Member" },
    { id: "public", name: "Jamie Park", email: "jamie@example.com", tier: "Free", groups: ["all", "public"], role: "Guest" },
  ];

  var currentUserId = null;
  var currentUser = null;

  /* ============================================================
     DOM REFS
     ============================================================ */
  var loginOverlay = null;
  var loginForm = null;
  var loginEmail = null;
  var loginPassword = null;
  var loginError = null;
  var portalPage = null;
  var sidebar = null;
  var sidebarToggle = null;

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    loginOverlay = document.getElementById("login-overlay");
    loginForm = document.getElementById("login-form");
    loginEmail = document.getElementById("login-email");
    loginPassword = document.getElementById("login-password");
    loginError = document.getElementById("login-error");
    portalPage = document.getElementById("portal-page");
    sidebar = document.getElementById("portal-sidebar");
    sidebarToggle = document.getElementById("sidebar-toggle");

    if (loginForm) {
      loginForm.addEventListener("submit", handleLogin);
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", toggleSidebar);
    }

    // Close sidebar when clicking overlay on mobile
    if (sidebar) {
      sidebar.addEventListener("click", function (e) {
        if (window.innerWidth <= 767) {
          sidebar.classList.remove("open");
          sidebarToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Check for saved session
    var saved = localStorage.getItem("beckcloud-portal-user");
    if (saved) {
      try {
        var u = JSON.parse(saved);
        var found = USERS.find(function (x) { return x.id === u.id; });
        if (found) {
          currentUser = found;
          currentUserId = found.id;
          showPortal();
          return;
        }
      } catch (e) { /* ignore */ }
    }

    // Show login
    if (loginOverlay) loginOverlay.style.display = "flex";
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  function handleLogin(e) {
    e.preventDefault();

    var email = loginEmail.value.trim();
    var password = loginPassword.value;

    if (!email) {
      loginError.textContent = "Email is required.";
      return;
    }

    // Find matching user by email or use demo
    var user = USERS.find(function (u) { return u.email === email; });

    if (!user) {
      // Demo mode: accept any input, pick a random user for demo
      user = USERS[Math.floor(Math.random() * USERS.length)];
      loginError.textContent = "Demo mode: logged in as " + user.name;
      setTimeout(function () {
        loginError.textContent = "";
      }, 2000);
    } else {
      loginError.textContent = "";
    }

    currentUser = user;
    currentUserId = user.id;
    localStorage.setItem("beckcloud-portal-user", JSON.stringify({ id: user.id }));

    showPortal();
  }

  function showPortal() {
    if (loginOverlay) loginOverlay.style.display = "none";
    if (portalPage) portalPage.style.display = "block";
    renderAll();
  }

  function logout() {
    currentUser = null;
    currentUserId = null;
    localStorage.removeItem("beckcloud-portal-user");
    if (portalPage) portalPage.style.display = "none";
    if (loginOverlay) loginOverlay.style.display = "flex";
    if (loginEmail) loginEmail.value = "";
    if (loginPassword) loginPassword.value = "";
    if (loginError) loginError.textContent = "";
  }

  function toggleSidebar() {
    var isOpen = sidebar.classList.contains("open");
    sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", String(!isOpen));
  }

  /* ============================================================
     PERMISSION CHECK
     ============================================================ */
  function userHasAccess(service) {
    return currentUser.groups.indexOf(service.group) !== -1;
  }

  function getUserServices() {
    return SERVICES.filter(function (s) { return userHasAccess(s); });
  }

  function getAccessCategories() {
    var services = getUserServices();
    var cats = {};
    services.forEach(function (s) {
      if (!cats[s.category]) cats[s.category] = 0;
      cats[s.category]++;
    });
    return Object.keys(cats).sort();
  }

  /* ============================================================
     RENDER ALL
     ============================================================ */
  function renderAll() {
    renderGreeting();
    renderQuickAccess();
    renderStatusOverview();
    renderSearchFilters();
    renderServicesGrid();
    renderAccount();
    renderUserInfo();
  }

  /* ============================================================
     GREETING
     ============================================================ */
  function renderGreeting() {
    var titleEl = document.getElementById("greeting-title");
    var subtitleEl = document.getElementById("greeting-subtitle");
    if (!titleEl || !subtitleEl) return;

    var hour = new Date().getHours();
    var greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";

    titleEl.textContent = greeting + ", " + currentUser.name.split(" ")[0] + " 👋";

    var accessibleCount = getUserServices().length;
    var runningCount = getUserServices().filter(function (s) {
      return SERVICE_STATUS[s.id] && SERVICE_STATUS[s.id].state === "running";
    }).length;

    subtitleEl.textContent = runningCount + " of " + accessibleCount + " services healthy. Everything's running. For now.";

    var statServices = document.getElementById("g-stat-services");
    var statUp = document.getElementById("g-stat-up");
    if (statServices) statServices.querySelector(".g-stat-value").textContent = accessibleCount;
    if (statUp) statUp.querySelector(".g-stat-value").textContent = runningCount;
  }

  /* ============================================================
     USER INFO (sidebar)
     ============================================================ */
  function renderUserInfo() {
    var avatarEl = document.getElementById("user-avatar");
    var nameEl = document.getElementById("user-name");
    var rolesEl = document.getElementById("user-roles");
    if (!avatarEl) return;

    var initials = currentUser.name.split(" ").map(function (n) { return n[0]; }).join("").toUpperCase();
    avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = currentUser.name;
    if (rolesEl) rolesEl.textContent = currentUser.role + " · " + currentUser.tier;
  }

  /* ============================================================
     QUICK ACCESS
     ============================================================ */
  function renderQuickAccess() {
    var container = document.getElementById("quick-access-grid");
    if (!container) return;
    container.innerHTML = "";

    var userServices = getUserServices();
    // Show first 6 as quick access
    var quick = userServices.slice(0, 6);

    if (quick.length === 0) {
      container.innerHTML = '<p style="color:var(--text-tertiary);grid-column:1/-1;">No quick-access services. Check the full services list below.</p>';
      return;
    }

    quick.forEach(function (s) {
      var status = SERVICE_STATUS[s.id];
      var statusClass = status ? status.state : "unknown";
      var card = document.createElement("a");
      card.className = "quick-card";
      card.href = s.url;
      card.target = "_blank";
      card.rel = "noopener";

      var catColors = {
        "Security & Identity": "rgba(232,168,56,0.1)",
        "Monitoring": "rgba(124,92,252,0.1)",
        "Development": "rgba(255,107,74,0.1)",
        "Media": "rgba(74,222,128,0.1)",
        "3D Printing": "rgba(251,191,36,0.1)",
        "Micro Services": "rgba(96,165,250,0.1)",
        "Infrastructure": "rgba(148,163,184,0.1)",
      };

      card.innerHTML =
        '<div class="quick-card-icon" style="background:' + (catColors[s.category] || "var(--bg-tertiary)") + '">' +
          s.icon +
        '</div>' +
        '<div class="quick-card-label">' + s.name + '</div>' +
        '<div class="quick-card-url">' + s.url + '</div>';

      container.appendChild(card);
    });
  }

  /* ============================================================
     STATUS OVERVIEW
     ============================================================ */
  function renderStatusOverview() {
    var container = document.getElementById("status-overview");
    if (!container) return;
    container.innerHTML = "";

    var userServices = getUserServices();
    if (userServices.length === 0) return;

    userServices.forEach(function (s) {
      var status = SERVICE_STATUS[s.id];
      var statusClass = status ? status.state : "unknown";

      var row = document.createElement("div");
      row.className = "status-row";
      row.innerHTML =
        '<div class="status-dot ' + statusClass + '"></div>' +
        '<div class="status-name">' + s.icon + ' ' + s.name + '</div>' +
        '<div class="status-meta">' +
          '<span class="status-badge ' + statusClass + '">' + statusClass.charAt(0).toUpperCase() + statusClass.slice(1) + '</span>' +
          (status && status.uptime ? '<span class="status-uptime">' + status.uptime + ' uptime</span>' : '') +
        '</div>';

      container.appendChild(row);
    });
  }

  /* ============================================================
     SEARCH & FILTERS
     ============================================================ */
  function renderSearchFilters() {
    var container = document.getElementById("filter-chips");
    if (!container) return;
    container.innerHTML = "";

    var cats = getAccessCategories();

    var allChip = document.createElement("button");
    allChip.className = "filter-chip filter-chip-active";
    allChip.dataset.filter = "all";
    allChip.textContent = "All";
    container.appendChild(allChip);

    cats.forEach(function (cat) {
      var chip = document.createElement("button");
      chip.className = "filter-chip";
      chip.dataset.filter = cat;
      chip.textContent = cat;
      container.appendChild(chip);
    });

    // Event delegation for filter clicks
    container.addEventListener("click", function (e) {
      if (!e.target.classList.contains("filter-chip")) return;
      container.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("filter-chip-active"); });
      e.target.classList.add("filter-chip-active");
      renderServicesGrid();
    });
  }

  /* ============================================================
     SERVICES GRID
     ============================================================ */
  function renderServicesGrid() {
    var container = document.getElementById("services-cards-grid");
    var noResults = document.getElementById("no-results");
    if (!container) return;
    container.innerHTML = "";

    var searchTerm = "";
    var searchInput = document.getElementById("service-search");
    if (searchInput) searchTerm = searchInput.value.trim().toLowerCase();

    var activeFilter = document.querySelector(".filter-chip-active");
    var filterCategory = activeFilter ? activeFilter.dataset.filter : "all";

    var userServices = getUserServices();

    // Filter
    var filtered = userServices.filter(function (s) {
      var matchesSearch = !searchTerm ||
        s.name.toLowerCase().indexOf(searchTerm) !== -1 ||
        s.description.toLowerCase().indexOf(searchTerm) !== -1 ||
        s.category.toLowerCase().indexOf(searchTerm) !== -1;
      var matchesFilter = filterCategory === "all" || s.category === filterCategory;
      return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
      if (noResults) noResults.style.display = "flex";
      return;
    }

    if (noResults) noResults.style.display = "none";

    filtered.forEach(function (s) {
      var status = SERVICE_STATUS[s.id];
      var statusClass = status ? status.state : "unknown";

      var card = document.createElement("a");
      card.className = "service-card";
      card.href = s.url;
      card.target = "_blank";
      card.rel = "noopener";

      card.innerHTML =
        '<div class="service-card-status">' +
          '<div class="service-card-icon">' + s.icon + '</div>' +
          '<span class="status-dot ' + statusClass + '" title="' + statusClass + '"></span>' +
        '</div>' +
        '<div class="service-card-info">' +
          '<div class="service-card-name">' + s.name + '</div>' +
          '<div class="service-card-desc">' + s.description + '</div>' +
        '</div>' +
        '<div class="service-card-right">' +
          '<span class="service-card-url">' + s.url + '</span>' +
          '<svg class="service-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>' +
          '</svg>' +
        '</div>';

      container.appendChild(card);
    });
  }

  /* ============================================================
     SEARCH EVENT
     ============================================================ */
  function initSearch() {
    var searchInput = document.getElementById("service-search");
    var clearBtn = document.getElementById("search-clear");
    if (!searchInput) return;

    searchInput.addEventListener("input", function () {
      var val = searchInput.value.trim();
      if (clearBtn) clearBtn.style.display = val ? "flex" : "none";
      renderServicesGrid();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        searchInput.value = "";
        clearBtn.style.display = "none";
        renderServicesGrid();
        searchInput.focus();
      });
    }
  }

  /* ============================================================
     ACCOUNT SECTION
     ============================================================ */
  function renderAccount() {
    var container = document.getElementById("account-card");
    if (!container) return;
    container.innerHTML = "";

    var userServices = getUserServices();
    var runningServices = userServices.filter(function (s) {
      return SERVICE_STATUS[s.id] && SERVICE_STATUS[s.id].state === "running";
    });

    var initials = currentUser.name.split(" ").map(function (n) { return n[0]; }).join("").toUpperCase();

    var html = '';
    html += '<div class="account-header">';
    html += '<div class="account-avatar">' + initials + '</div>';
    html += '<div class="account-info">';
    html += '<div class="account-name">' + currentUser.name + '</div>';
    html += '<div class="account-email">' + currentUser.email + '</div>';
    html += '<span class="account-tier-badge">' + currentUser.tier + '</span>';
    html += '</div></div>';

    html += '<div class="account-details-grid">';

    // Groups
    html += '<div class="account-detail-block"><h3>Access Groups</h3><div class="account-tags">';
    currentUser.groups.forEach(function (g) {
      var labels = {
        all: "All Services", admin: "Admin", media: "Media",
        "3dprinting": "3D Printing", public: "Public", llm: "LLM"
      };
      html += '<span class="account-tag">' + (labels[g] || g) + '</span>';
    });
    html += '</div></div>';

    // Service count
    html += '<div class="account-detail-block"><h3>Accessible Services</h3>';
    html += '<div class="account-detail-value">';
    html += '<strong style="color:var(--text-primary);font-size:1.25rem;">' + userServices.length + '</strong> services accessible';
    html += ' — <span style="color:var(--status-success);">' + runningServices.length + '</span> currently healthy';
    html += '</div></div>';

    // Account details
    html += '<div class="account-detail-block"><h3>Account Details</h3>';
    html += '<div class="account-detail-value">';
    html += '<div style="margin-bottom:0.5rem;"><strong style="color:var(--text-secondary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Role</strong><br>' + currentUser.role + '</div>';
    html += '<div style="margin-bottom:0.5rem;"><strong style="color:var(--text-secondary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Tier</strong><br>' + currentUser.tier + '</div>';
    html += '<div><strong style="color:var(--text-secondary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Auth</strong><br>Keycloak SSO</div>';
    html += '</div></div>';

    html += '</div>';

    container.innerHTML = html;
  }

  /* ============================================================
     NAV LINKS
     ============================================================ */
  function initNavLinks() {
    var links = document.querySelectorAll(".sidebar-link");
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        links.forEach(function (l) { l.classList.remove("sidebar-link-active"); });
        this.classList.add("sidebar-link-active");

        // Close sidebar on mobile
        if (window.innerWidth <= 767) {
          sidebar.classList.remove("open");
          sidebarToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /* ============================================================
     LOGOUT BUTTON
     ============================================================ */
  function initLogout() {
    var btn = document.getElementById("btn-logout");
    if (btn) btn.addEventListener("click", logout);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      initSearch();
      initNavLinks();
      initLogout();
    });
  } else {
    init();
    initSearch();
    initNavLinks();
    initLogout();
  }

})();
