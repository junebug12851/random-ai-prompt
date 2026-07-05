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
    return p !== "index.html" && p.indexOf("tutorial-") !== 0;
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

  function run() {
    if (document.documentElement.hasAttribute("data-ff-themed")) return;
    document.documentElement.setAttribute("data-ff-themed", "");
    // Hide docdash's module sidebar everywhere except the API pages.
    if (!isApiPage()) document.documentElement.classList.add("ff-no-sidebar");
    injectHead();
    injectHeader();
    injectFooter();
    pruneSidebar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
