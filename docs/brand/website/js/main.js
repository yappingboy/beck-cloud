/* BeckCloud Landing Page — Minimal JS
 * Mobile nav toggle, smooth scroll, scroll-reveal animations.
 * No tracking. No analytics. No dependencies.
 */

(function () {
  "use strict";

  /* ---- Mobile hamburger toggle ---- */
  var hamburger = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });

    /* Close menu when a link is clicked */
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var href = anchor.getAttribute("href");
      if (href === "#") return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var headerHeight = document.getElementById("site-header")
          ? document.getElementById("site-header").offsetHeight
          : 64;
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  });

  /* ---- Scroll-reveal animations ---- */
  /* Only activate if the browser supports IntersectionObserver */
  if ("IntersectionObserver" in window) {
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length > 0) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -40px 0px",
        }
      );

      reveals.forEach(function (el) {
        observer.observe(el);
      });
    }
  } else {
    /* Fallback: show everything immediately */
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("visible");
    });
  }

  /* ---- Header background on scroll ---- */
  var header = document.getElementById("site-header");
  if (header) {
    var lastScroll = 0;
    var ticking = false;

    window.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var scrollY = window.pageYOffset;
          if (scrollY > 80) {
            header.style.borderBottomColor = "var(--border-default)";
          } else {
            header.style.borderBottomColor = "var(--border-subtle)";
          }
          lastScroll = scrollY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ============================================================
     ACCOUNT REQUEST FORM
     ============================================================ */
  var form = document.getElementById("account-form");
  if (form) {
    var currentStep = 1;
    var totalSteps = 4;

    var stepDots = document.querySelectorAll("#step-indicator .step-dot");
    var connectors = document.querySelectorAll("#step-indicator .step-connector");
    var steps = document.querySelectorAll(".form-step");
    var btnBack = document.getElementById("btn-back");
    var btnNext = document.getElementById("btn-next");
    var formNav = document.getElementById("form-nav");
    var formSuccess = document.getElementById("form-success");

    /* Initialize */
    btnBack.disabled = true;

    /* Update step indicators */
    function updateStepIndicators(step) {
      stepDots.forEach(function (dot) {
        var s = parseInt(dot.dataset.step);
        dot.classList.remove("step-active", "completed");
        if (s < step) {
          dot.classList.add("completed");
        } else if (s === step) {
          dot.classList.add("step-active");
          dot.setAttribute("aria-current", "step");
        } else {
          dot.removeAttribute("aria-current");
        }
      });

      connectors.forEach(function (conn, i) {
        conn.classList.toggle("active", i < step - 1);
      });
    }

    /* Show a specific step */
    function showStep(step) {
      steps.forEach(function (s) {
        s.classList.remove("form-step-active");
      });
      var target = document.querySelector(".form-step[data-form-step=\"" + step + "\"]");
      if (target) {
        target.classList.add("form-step-active");
      }

      /* Build confirmation summary on step 4 */
      if (step === 4) {
        buildConfirmation();
      }

      /* Navigation state */
      btnBack.disabled = step === 1;
      if (step >= totalSteps) {
        formNav.style.display = "none";
      } else {
        formNav.style.display = "flex";
      }

      updateStepIndicators(step);

      /* Scroll to top of form on step change */
      var contactSection = document.getElementById("contact");
      if (contactSection) {
        var headerHeight = document.getElementById("site-header")
          ? document.getElementById("site-header").offsetHeight
          : 64;
        window.scrollTo({
          top: contactSection.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16,
          behavior: "smooth",
        });
      }
    }

    /* Build confirmation summary */
    function buildConfirmation() {
      var name = document.getElementById("form-name").value.trim();
      var email = document.getElementById("form-email").value.trim();
      var purpose = document.getElementById("form-purpose").value.trim();

      var services = [];
      var checked = document.querySelectorAll('input[name="services"]:checked');
      checked.forEach(function (cb) {
        services.push(cb.value);
      });

      var groups = [];
      checked = document.querySelectorAll('input[name="groups"]:checked');
      checked.forEach(function (cb) {
        groups.push(cb.value);
      });

      var summary = document.getElementById("confirmation-summary");
      if (!summary) return;

      var serviceLabels = {
        sso: "SSO Platform",
        vault: "Password Vault",
        wazuh: "Wazuh Security",
        wiki: "Wiki & Docs",
        cms: "CMS Platform",
        affine: "Affine Workspace",
        silex: "Silex Editor",
        jellyfin: "Jellyfin Media",
        swiparr: "Swiparr",
        manyfold: "Manyfold",
        fdm: "FDM Monster",
        gridspace: "Gridspace",
        "static-sites": "Static Site Hosting",
        "url-shortener": "URL Shortener",
        qr: "QR Code Generator",
        hash: "Hash Service",
        cron: "Cron Jobs",
        "image-resize": "Image Resize",
        markdown: "Markdown Renderer",
      };

      var groupLabels = {
        admins: "Admin",
        media: "Media",
        "3dprinting": "3D Printing",
        llm: "LLM",
        opennebula: "OpenNebula",
      };

      var html = '<h4>Your Request</h4>';
      html += '<div class="confirmation-row">';
      html += '<div class="confirmation-row-label">Name</div>';
      html += '<div class="confirmation-row-value"><strong>' + escapeHtml(name) + '</strong></div>';
      html += '</div>';

      html += '<div class="confirmation-row">';
      html += '<div class="confirmation-row-label">Email</div>';
      html += '<div class="confirmation-row-value">' + escapeHtml(email) + '</div>';
      html += '</div>';

      if (purpose) {
        html += '<div class="confirmation-row">';
        html += '<div class="confirmation-row-label">Purpose</div>';
        html += '<div class="confirmation-row-value">' + escapeHtml(purpose) + '</div>';
        html += '</div>';
      }

      if (services.length > 0) {
        html += '<div class="confirmation-row">';
        html += '<div class="confirmation-row-label">Services</div>';
        html += '<div class="confirmation-row-value"><div class="confirmation-tags">';
        services.forEach(function (s) {
          html += '<span class="confirmation-tag">' + escapeHtml(serviceLabels[s] || s) + '</span>';
        });
        html += '</div></div></div>';
      }

      if (groups.length > 0) {
        html += '<div class="confirmation-row">';
        html += '<div class="confirmation-row-label">Access Groups</div>';
        html += '<div class="confirmation-row-value"><div class="confirmation-tags">';
        groups.forEach(function (g) {
          html += '<span class="confirmation-tag">' + escapeHtml(groupLabels[g] || g) + '</span>';
        });
        html += '</div></div></div>';
      }

      summary.innerHTML = html;
    }

    function escapeHtml(str) {
      var div = document.createElement("div");
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    /* Validate step */
    function validateStep(step) {
      var valid = true;

      if (step === 1) {
        var name = document.getElementById("form-name").value.trim();
        var email = document.getElementById("form-email").value.trim();
        var nameError = document.getElementById("name-error");
        var emailError = document.getElementById("email-error");

        if (!name) {
          nameError.textContent = "Name is required.";
          valid = false;
        } else {
          nameError.textContent = "";
        }

        if (!email) {
          emailError.textContent = "Email is required.";
          valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          emailError.textContent = "Please enter a valid email address.";
          valid = false;
        } else {
          emailError.textContent = "";
        }
      }

      if (step === 2) {
        var checked = document.querySelectorAll('input[name="services"]:checked');
        var servicesError = document.getElementById("services-error");
        if (checked.length === 0) {
          servicesError.textContent = "Please select at least one service.";
          valid = false;
        } else {
          servicesError.textContent = "";
        }
      }

      if (step === 3) {
        var checked = document.querySelectorAll('input[name="groups"]:checked');
        var groupsError = document.getElementById("groups-error");
        if (checked.length === 0) {
          groupsError.textContent = "Please select at least one access group.";
          valid = false;
        } else {
          groupsError.textContent = "";
        }
      }

      return valid;
    }

    /* Next button */
    btnNext.addEventListener("click", function () {
      if (validateStep(currentStep)) {
        currentStep++;
        if (currentStep > totalSteps) currentStep = totalSteps;
        showStep(currentStep);
      }
    });

    /* Back button */
    btnBack.addEventListener("click", function () {
      if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
      }
    });

    /* Submit form */
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = document.getElementById("form-name").value.trim();
      var email = document.getElementById("form-email").value.trim();
      var purpose = document.getElementById("form-purpose").value.trim();

      var services = [];
      document.querySelectorAll('input[name="services"]:checked').forEach(function (cb) {
        services.push(cb.value);
      });

      var groups = [];
      document.querySelectorAll('input[name="groups"]:checked').forEach(function (cb) {
        groups.push(cb.value);
      });

      /* Build mailto link */
      var subject = encodeURIComponent("BeckCloud Account Request");
      var body = [
        "BeckCloud Account Request",
        "",
        "Name: " + name,
        "Email: " + email,
        "Purpose: " + (purpose || "Not specified"),
        "",
        "Services requested:",
      ]
        .concat(services.map(function (s) { return "  - " + s; }))
        .concat(["", "Access groups:"])
        .concat(groups.map(function (g) { return "  - " + g; }))
        .concat(["", "---", "Sent from beckcloud.cloud"])
        .join("\n");

      var mailtoLink = "mailto:contact@beckcloud.cloud?subject=" + subject + "&body=" + encodeURIComponent(body);

      /* Open mailto */
      window.location.href = mailtoLink;

      /* Show success */
      form.style.display = "none";
      document.getElementById("step-indicator").style.display = "none";
      formSuccess.style.display = "block";

      /* Heartbeat for card */
      if (window.beckCloudHeartbeat) {
        window.beckCloudHeartbeat("account-request-submitted");
      }
    });

    /* Clear errors on input */
    document.getElementById("form-name").addEventListener("input", function () {
      document.getElementById("name-error").textContent = "";
    });
    document.getElementById("form-email").addEventListener("input", function () {
      document.getElementById("email-error").textContent = "";
    });
    document.getElementById("form-purpose").addEventListener("input", function () {
      /* no error for purpose */
    });
  }
})();
