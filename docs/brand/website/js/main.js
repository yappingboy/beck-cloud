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
})();
