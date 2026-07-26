/* BeckCloud — Services Directory JS
 * Filter by category, toggle internal visibility, search by text.
 * No dependencies. No tracking.
 */

(function () {
  "use strict";

  var cards = document.querySelectorAll(".service-card");
  var searchInput = document.getElementById("service-search");
  var showInternal = document.getElementById("show-internal");
  var pills = document.querySelectorAll(".filter-pill");
  var resultCount = document.getElementById("result-count");
  var activeCategory = "all";

  function countVisible() {
    var n = 0;
    cards.forEach(function (c) { if (!c.classList.contains("hidden")) n++; });
    return n;
  }

  function updateCount() {
    if (resultCount) {
      var visible = countVisible();
      resultCount.textContent = visible + " of " + cards.length + " services";
    }
  }

  function filterCards() {
    var query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    var includeInternal = showInternal ? showInternal.checked : false;

    cards.forEach(function (card) {
      var cat = card.getAttribute("data-category");
      var isInternal = card.getAttribute("data-visibility") === "internal";
      var title = (card.querySelector(".card-title") || {}).textContent || "";
      var body = (card.querySelector(".card-body") || {}).textContent || "";
      var host = (card.querySelector(".card-host") || {}).textContent || "";

      var matchCat = activeCategory === "all" || cat === activeCategory;
      var matchSearch = !query ||
        title.toLowerCase().indexOf(query) !== -1 ||
        body.toLowerCase().indexOf(query) !== -1 ||
        host.toLowerCase().indexOf(query) !== -1;
      var matchVisibility = !isInternal || includeInternal;

      if (matchCat && matchSearch && matchVisibility) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });

    updateCount();
  }

  /* Category pills */
  pills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      pills.forEach(function (p) { p.classList.remove("active"); });
      pill.classList.add("active");
      activeCategory = pill.getAttribute("data-filter");
      filterCards();
    });
  });

  /* Search input */
  if (searchInput) {
    searchInput.addEventListener("input", filterCards);
  }

  /* Internal toggle */
  if (showInternal) {
    showInternal.addEventListener("change", filterCards);
  }

  /* Scroll-reveal (matches landing page) */
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
        { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
      );
      reveals.forEach(function (el) { observer.observe(el); });
    }
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("visible");
    });
  }

  /* Mobile nav toggle (shared with landing page) */
  var hamburger = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Smooth scroll for anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var href = anchor.getAttribute("href");
      if (href === "#") return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var headerHeight = document.getElementById("site-header")
          ? document.getElementById("site-header").offsetHeight : 64;
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  });

  /* Initial count */
  updateCount();
})();
