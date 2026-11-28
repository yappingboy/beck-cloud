/* BeckCloud services directory — live service status.
 * Each public card carries data-status-key="<key>"; this page's nginx
 * exposes same-origin /ping/<key> endpoints that proxy an in-cluster
 * health request and answer 200 (up) or 503 (down).
 * No CORS gymnastics, and unlike browser-only probes it also catches
 * apps that are "reachable" but erroring (Traefik 502/503 = down).
 */
(function () {
  "use strict";

  var cards = document.querySelectorAll("[data-status-key]");

  function set(card, cls, label) {
    var b = card.querySelector(".status-badge");
    if (!b) return;
    b.className = "status-badge " + cls;
    b.innerHTML = '<span class="status-dot"></span>' + label;
  }

  function probe(card) {
    var key = card.getAttribute("data-status-key");
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);

    fetch("/ping/" + encodeURIComponent(key), {
      cache: "no-store",
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (res) {
        clearTimeout(timer);
        if (res.status === 200) set(card, "public", "up");
        else set(card, "down", "down");
      })
      .catch(function () {
        clearTimeout(timer);
        set(card, "unknown", "unknown");
      });
  }

  /* Stagger so the little nginx never sees a thundering herd. */
  var list = Array.prototype.slice.call(cards);
  var i = 0;
  (function next() {
    if (i >= list.length) return;
    probe(list[i]);
    i += 1;
    setTimeout(next, 250);
  })();

  /* Empty state: reveal a hint when the active filters hide every card.
   * services.js owns filtering; we just watch the DOM it mutates. */
  var grid = document.getElementById("services-grid");
  var empty = document.getElementById("empty-state");
  if (grid && empty) {
    var check = function () {
      var visible = grid.querySelectorAll(".service-card:not(.hidden)").length;
      empty.hidden = visible !== 0;
    };
    document.addEventListener("input", function (e) {
      if (e.target && e.target.id === "service-search") setTimeout(check, 0);
    });
    document.addEventListener("click", function (e) {
      if (e.target && e.target.classList.contains("filter-pill")) setTimeout(check, 0);
    });
    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "show-internal") setTimeout(check, 0);
    });
    check();
  }
})();
