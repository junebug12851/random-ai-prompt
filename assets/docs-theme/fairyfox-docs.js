/*
 * fairyfox-docs.js — injects the fairyfox.io shell into the generated (docdash)
 * doc-site so it reads as part of fairyfox.io and offers the REQUIRED two-way way
 * back: a Fairy Fox brand → fairyfox.io on every page, a breadcrumb locator to the
 * project's node page, and a footer linking back to the main site's sections.
 *
 * It also injects the shared fonts (Fraunces/Inter/JetBrains) and the light+dark
 * theme-color metas so crossing the boundary between fairyfox.io and this docs site
 * has no visible "jump". Pure DOM, no dependencies. See fairyfox-docs.css.
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

  function injectHead() {
    var head = document.head;
    // theme-color metas (match the main site exactly)
    [
      ["#ef6149", "(prefers-color-scheme: light)"],
      ["#191116", "(prefers-color-scheme: dark)"],
    ].forEach(function (t) {
      head.appendChild(el("meta", { name: "theme-color", content: t[0], media: t[1] }));
    });
    // fonts: preconnect + the same family/weights the main site preloads
    head.appendChild(el("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }));
    head.appendChild(el("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }));
    head.appendChild(
      el("link", {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700" +
          "&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      })
    );
  }

  function brand() {
    return (
      '<a class="ff-brand" href="' + HUB + '/">' +
      '<span class="ff-logo" aria-hidden="true">F</span>' +
      '<span>Fairy&nbsp;Fox</span></a>'
    );
  }

  function injectBrand() {
    // Brand block at the top of docdash's persistent sidebar (<nav>) — the way
    // home, present on every page. Falls back to body if the sidebar isn't found.
    var block = el("div", { class: "ff-brand-block", role: "banner" });
    block.innerHTML =
      brand() +
      '<span class="ff-sub">' + NAME + "</span>" +
      '<a class="ff-back" href="' + HUB + '/">↩ Back to Fairy Fox</a>';
    var nav = document.querySelector("nav");
    if (nav) nav.insertBefore(block, nav.firstChild);
    else document.body.insertBefore(block, document.body.firstChild);
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
      '<a href="' + REPO + '/tree/master/notes">Notes ↗</a>' +
      '<a href="index.html">Docs home</a></div>' +
      "</div>" +
      '<div class="ff-foot-bar"><div class="ff-foot-wrap">' +
      "<span>© " + new Date().getFullYear() + " Fairy Fox</span>" +
      "<span>A project under <a href=\"" + HUB + "/\">Fairy&nbsp;Fox</a></span>" +
      '<span class="spacer"></span>' +
      '<a href="https://github.com/junebug12851">@junebug12851</a>' +
      "</div></div>";
    // append inside the content column so the fixed sidebar doesn't overlap it.
    var main = document.getElementById("main");
    (main || document.body).appendChild(foot);
  }

  function run() {
    if (document.documentElement.hasAttribute("data-ff-themed")) return;
    document.documentElement.setAttribute("data-ff-themed", "");
    injectHead();
    injectBrand();
    injectFooter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
