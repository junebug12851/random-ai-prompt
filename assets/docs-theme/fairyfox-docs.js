/*
 * fairyfox-docs.js — wraps the generated (docdash) doc-site in the fairyfox.io
 * shell so it reads as part of the mesh. It injects, on every page:
 *
 *   1. A COPY of the fairyfox.io site-header (brand → fairyfox.io + the hub's
 *      primary nav: Home / Projects / Docs / Downloads / Updates / About), and
 *   2. A well-organized project SUBNAV — the in-docs section bar (Overview,
 *      Project Notes, Systems, Reference, Changelog + Repository/Notes links).
 *
 * This mirrors the sibling `fairyfox-games` project, which copied the hub header
 * and added an organized subnav to its own static site. The two-way way back to
 * Fairy Fox lives in the header brand + primary nav (and the footer below).
 *
 * It also injects the SELF-HOSTED shared fonts (Fraunces/Inter/JetBrains, served
 * from this site's own origin — never Google Fonts, matching the project's
 * privacy stance) and the light+dark theme-color metas, so crossing the boundary
 * from fairyfox.io has no visible "jump". Pure DOM, no dependencies. Styling +
 * the docdash layout offsets live in fairyfox-docs.css.
 */
(function () {
  "use strict";
  var HUB = "https://fairyfox.io";
  var KEY = "random-ai-prompt";
  var NAME = "Random AI Prompt";
  var NODE = HUB + "/projects/" + KEY + "/";
  var REPO = "https://github.com/junebug12851/" + KEY;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  // The current page's bare filename (docdash writes every page flat into the
  // output dir, so relative links like "index.html" / "tutorial-*.html" resolve
  // from anywhere). Used to mark the active subnav item.
  function here() {
    var p = location.pathname.split("/").pop();
    return p || "index.html";
  }

  // The code-reference (API) pages are the docdash module/global/source pages —
  // everything that ISN'T the Overview home or a notes tutorial. Only these show
  // the module sidebar; every other page renders full-width (see .ff-no-sidebar).
  function isApiPage() {
    var p = here();
    return p !== "index.html" && p !== "download.html" && p.indexOf("tutorial-") !== 0;
  }

  function injectHead() {
    var head = document.head;
    // theme-color metas (match the main site exactly)
    [
      ["#ef6149", "(prefers-color-scheme: light)"],
      ["#191116", "(prefers-color-scheme: dark)"],
    ].forEach(function (t) {
      head.appendChild(el("meta", { name: "theme-color", content: t[0], media: t[1] }));
    });
    // Self-hosted fonts (Fraunces/Inter/JetBrains) — same families the main site
    // uses, served from this origin. No third-party (Google Fonts) request.
    head.appendChild(
      el("link", { rel: "stylesheet", href: "assets/docs-theme/fonts/fonts.css" }),
    );
  }

  // A COPY of the fairyfox.io header + the project subnav, inserted at the very
  // top of <body> (above docdash's fixed sidebar + #main, which the CSS offsets).
  function injectHeader() {
    var page = here();
    var primary = [
      ["Home", HUB + "/", false],
      ["Projects", HUB + "/projects/", false],
      ["Docs", HUB + "/docs/", true],
      ["Downloads", HUB + "/downloads/", false],
      ["Updates", HUB + "/blog/", false],
      ["About", HUB + "/about/", false],
    ]
      .map(function (n) {
        return '<a href="' + n[1] + '"' + (n[2] ? ' class="active"' : "") + ">" + n[0] + "</a>";
      })
      .join("");

    var header = el("header", { class: "site-header ff-header", role: "banner" });
    header.innerHTML =
      '<div class="wrap">' +
      '<a class="brand" href="' + HUB + '/">' +
      '<img class="brand-logo" src="' + HUB + '/assets/icons/fox.png" alt="" aria-hidden="true">' +
      '<span class="brand-name">Fairy&nbsp;Fox</span></a>' +
      '<nav class="nav" aria-label="Primary">' + primary + "</nav>" +
      "</div>";

    // In-docs section bar. Links are stable docdash tutorial ids derived from the
    // notes folder tree (see scripts/build-docs.mjs). "Overview" is the docs home;
    // "API" is the code reference (the only area that shows docdash's module
    // sidebar — see isApiPage / the .ff-no-sidebar class below).
    var sub = [
      ["Overview", "index.html"],
      ["Project Notes", "tutorial-notes__index.html"],
      ["Systems", "tutorial-notes__systems__index.html"],
      ["Reference", "tutorial-notes__reference__index.html"],
      ["Changelog", "tutorial-notes__version.html"],
      ["API", "global.html"],
      ["Download", "download.html"],
    ]
      .map(function (n) {
        // "API" is active across the whole code-reference area, not just its landing.
        var on = n[0] === "API" ? isApiPage() : n[1] === page;
        return '<a href="' + n[1] + '"' + (on ? ' class="active"' : "") + ">" + n[0] + "</a>";
      })
      .join("");

    var subnav = el("nav", { class: "subnav ff-subnav", "aria-label": NAME + " docs section" });
    subnav.innerHTML =
      '<div class="wrap">' +
      '<a class="sub-brand" href="index.html">' + NAME + "</a>" +
      sub +
      '<span class="sep" aria-hidden="true"></span>' +
      '<a class="ext" href="' + REPO + '">Repository ↗</a>' +
      '<a class="ext" href="' + REPO + '/tree/main/notes">Notes ↗</a>' +
      "</div>";

    // One fixed container holds the header + subnav; its measured height feeds the
    // --ff-header-h var so docdash's sidebar/#main clear it exactly, even if the
    // subnav wraps. Measured after insert and on resize.
    var top = el("div", { class: "ff-top" });
    top.appendChild(header);
    top.appendChild(subnav);
    document.body.insertBefore(top, document.body.firstChild);

    function measure() {
      document.documentElement.style.setProperty("--ff-header-h", top.offsetHeight + "px");
    }
    measure();
    window.addEventListener("resize", measure);
    // Re-measure once fonts settle (they can change the header height).
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  function brand() {
    return (
      '<a class="ff-brand" href="' + HUB + '/">' +
      '<span class="ff-logo" aria-hidden="true">F</span>' +
      "<span>Fairy&nbsp;Fox</span></a>"
    );
  }

  function injectFooter() {
    var foot = el("footer", { class: "ff-foot" });
    foot.innerHTML =
      '<div class="ff-foot-wrap">' +
      '<div class="ff-foot-brand">' +
      brand() +
      "<p>Documentation for " + NAME + " — a project under Fairy Fox. " +
      "Built with JSDoc, themed to match fairyfox.io.</p></div>" +
      '<div class="ff-foot-col"><h4>Explore</h4>' +
      '<a href="' + HUB + '/projects/">Projects</a>' +
      '<a href="' + HUB + '/docs/">Documentation</a>' +
      '<a href="' + HUB + '/downloads/">Downloads</a>' +
      '<a href="' + HUB + '/blog/">Updates</a>' +
      '<a href="' + HUB + '/about/">About</a></div>' +
      '<div class="ff-foot-col"><h4>This project</h4>' +
      '<a href="' + NODE + '">Project node ↗</a>' +
      '<a href="' + REPO + '">Repository ↗</a>' +
      '<a href="' + REPO + '/tree/main/notes">Notes ↗</a>' +
      '<a href="index.html">Docs home</a></div>' +
      "</div>" +
      '<div class="ff-foot-bar"><div class="ff-foot-wrap">' +
      "<span>© " + new Date().getFullYear() + " Fairy Fox</span>" +
      '<span>A project under <a href="' + HUB + '/">Fairy&nbsp;Fox</a></span>' +
      '<span class="spacer"></span>' +
      '<a href="https://github.com/junebug12851">@junebug12851</a>' +
      "</div></div>";
    // append inside the content column so the fixed sidebar doesn't overlap it.
    var main = document.getElementById("main");
    (main || document.body).appendChild(foot);
  }

  // Trim redundant entries from docdash's sidebar now that the header + subnav
  // carry that navigation: the "Home" link (= Overview in the subnav), the
  // "GitHub" menu item (= Repository in the subnav; also dropped from
  // jsdoc.config.json), and the whole "Tutorials" section (moved to the subnav).
  function pruneSidebar() {
    var nav = document.querySelector("body > nav");
    if (!nav) return;
    var home = nav.querySelector('h2 a[href="index.html"]');
    if (home) {
      var h2 = home.closest("h2");
      if (h2) h2.remove();
    }
    nav.querySelectorAll("h3").forEach(function (h) {
      if (h.textContent.trim().toLowerCase() === "tutorials") {
        var ul = h.nextElementSibling;
        h.remove();
        if (ul && ul.tagName === "UL") ul.remove();
      }
    });
  }

  // On the notes tutorial pages docdash prints the title twice — the
  // "Tutorial: <title>" page heading AND a duplicate <h2> in the tutorial header.
  // Drop the "Tutorial:" prefix (these are project notes, not tutorials) and remove
  // the duplicate <h2>, leaving one clean title (plus the child list on hub pages).
  function tidyTutorialTitle() {
    if (here().indexOf("tutorial-") !== 0) return;
    var pt = document.querySelector("#main h1.page-title");
    if (!pt) return;
    var title = pt.textContent.replace(/^\s*Tutorial:\s*/, "").trim();
    pt.textContent = title;
    document.querySelectorAll("#main header h2").forEach(function (h) {
      if (h.textContent.trim() === title) {
        var hdr = h.parentNode;
        h.remove();
        if (hdr && hdr.tagName === "HEADER" && !hdr.querySelector("ul,ol,p,h1,h2,h3"))
          hdr.remove();
      }
    });
  }

  // ── Kindle-style reader settings (the "Aa" menu) ─────────────────────────────
  // Theme, text size, line spacing and reading width, tuned live and remembered.
  // Prefs live under an ORIGIN-WIDE localStorage key ("fairyfox:reader"), so the
  // choice is SHARED across every fairyfox.io site (the hub + project docs are all
  // served from the same origin) — each site just has to read the same key.
  // Theme drives data-theme on <html> (overriding prefers-color-scheme in CSS);
  // the text vars drive --reading-fs / --reading-lh / --reading-width.
  var READER_KEY = "fairyfox:reader";
  var SIZES = [0.92, 0.99, 1.05, 1.14, 1.24, 1.36]; // rem, stepped by A− / A+
  var LH = { tight: 1.6, normal: 1.8, relaxed: 2.05 };
  var WIDTH = { narrow: "38rem", normal: "46rem", wide: "56rem" };
  var DEFAULTS = { theme: "system", size: 2, lh: "normal", width: "normal" };
  var prefs = DEFAULTS;

  function clampSize(n) {
    return Math.max(0, Math.min(SIZES.length - 1, n | 0));
  }
  function loadPrefs() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(READER_KEY) || "{}"));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function savePrefs() {
    try {
      localStorage.setItem(READER_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }
  function applyPrefs() {
    var root = document.documentElement;
    if (prefs.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", prefs.theme);
    root.style.setProperty("--reading-fs", SIZES[clampSize(prefs.size)] + "rem");
    root.style.setProperty("--reading-lh", String(LH[prefs.lh] || LH.normal));
    root.style.setProperty("--reading-width", WIDTH[prefs.width] || WIDTH.normal);
  }

  function seg(act, opts) {
    return (
      '<div class="ff-seg" role="group">' +
      opts
        .map(function (o) {
          return (
            '<button type="button" data-act="' + act + '" data-val="' + o[0] + '">' + o[1] + "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function initReader() {
    prefs = loadPrefs();
    applyPrefs();

    var btn = el("button", {
      class: "ff-reader-btn",
      type: "button",
      "aria-label": "Reading settings",
      "aria-expanded": "false",
      title: "Reading settings",
    });
    btn.innerHTML = '<span class="aa-lg">A</span><span class="aa-sm">a</span>';

    var panel = el("div", { class: "ff-reader-panel", role: "dialog", "aria-label": "Reading settings" });
    panel.innerHTML =
      '<div class="ff-reader-row"><h5>Theme</h5>' +
      seg("theme", [["system", "Auto"], ["light", "Light"], ["sepia", "Sepia"], ["dark", "Dark"]]) +
      "</div>" +
      '<div class="ff-reader-row"><h5>Text size</h5>' +
      '<div class="ff-seg ff-size" role="group">' +
      '<button type="button" data-act="size-dec" class="aa-min" aria-label="Smaller text">A</button>' +
      '<button type="button" data-act="size-inc" class="aa-max" aria-label="Larger text">A</button>' +
      "</div></div>" +
      '<div class="ff-reader-row"><h5>Line spacing</h5>' +
      seg("lh", [["tight", "Tight"], ["normal", "Normal"], ["relaxed", "Relaxed"]]) +
      "</div>" +
      '<div class="ff-reader-row"><h5>Width</h5>' +
      seg("width", [["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]) +
      "</div>" +
      '<p class="ff-hint">Text size, spacing &amp; width apply to reading pages. Your choice is remembered across Fairy&nbsp;Fox.</p>';

    function markActive() {
      panel.querySelectorAll("button[data-act]").forEach(function (b) {
        var act = b.getAttribute("data-act");
        var on =
          (act === "theme" && b.getAttribute("data-val") === prefs.theme) ||
          (act === "lh" && b.getAttribute("data-val") === prefs.lh) ||
          (act === "width" && b.getAttribute("data-val") === prefs.width);
        if (act === "theme" || act === "lh" || act === "width")
          b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    markActive();

    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "theme") prefs.theme = b.getAttribute("data-val");
      else if (act === "lh") prefs.lh = b.getAttribute("data-val");
      else if (act === "width") prefs.width = b.getAttribute("data-val");
      else if (act === "size-dec") prefs.size = clampSize(prefs.size - 1);
      else if (act === "size-inc") prefs.size = clampSize(prefs.size + 1);
      applyPrefs();
      savePrefs();
      markActive();
    });

    function setOpen(open) {
      panel.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!panel.classList.contains("open"));
    });
    document.addEventListener("click", function (e) {
      if (panel.classList.contains("open") && !panel.contains(e.target) && e.target !== btn)
        setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    var wrap = document.querySelector(".ff-header .wrap");
    (wrap || document.body).appendChild(btn);
    document.body.appendChild(panel);
  }

  function run() {
    if (document.documentElement.hasAttribute("data-ff-themed")) return;
    document.documentElement.setAttribute("data-ff-themed", "");
    // Apply saved reading prefs early (before paint of the injected chrome) so the
    // theme doesn't flash; initReader() rebuilds the UI and re-applies.
    prefs = loadPrefs();
    applyPrefs();
    // Hide docdash's module sidebar everywhere except the API pages.
    if (!isApiPage()) document.documentElement.classList.add("ff-no-sidebar");
    // The Download page is a wider, card-based layout (not the narrow reading measure).
    if (here() === "download.html") document.documentElement.classList.add("ff-download");
    injectHead();
    injectHeader();
    injectFooter();
    pruneSidebar();
    tidyTutorialTitle();
    initReader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
