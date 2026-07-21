/* BeckCloud — Minimal site JS */
/* Mobile nav toggle + smooth scroll + theme toggle */

(function () {
  "use strict";

  /* ---- Mobile hamburger toggle ---- */
  const hamburger = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      const isOpen = navLinks.classList.toggle("open");
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
      var target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* ---- Theme toggle (dark / light) ---- */
  var themeButtons = document.querySelectorAll("#theme-toggle, #theme-toggle-mobile");

  if (themeButtons.length > 0) {
    /* Initialise theme from stored preference or OS default */
    function getTheme() {
      var stored = localStorage.getItem("theme");
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      var label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
      themeButtons.forEach(function (btn) { btn.setAttribute("aria-label", label); });
    }

    /* Apply on load */
    applyTheme(getTheme());

    themeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    });
  }
})();
