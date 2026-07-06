/**
 * chrome.js — injects the fairyfox.io site chrome onto every page: a skip link,
 * a copy of the hub header, the project subnav, and the footer. Also injects the
 * self-hosted fonts + theme-color metas.
 * @module docs-theme/chrome
 */

import { el, here, isApiPage, HUB, NAME, NODE, REPO } from "./util.js";

/** Inject theme-color metas + the self-hosted font stylesheet (no Google Fonts). */
export function injectHead() {
  const head = document.head;
  [
    ["#ef6149", "(prefers-color-scheme: light)"],
    ["#191116", "(prefers-color-scheme: dark)"],
  ].forEach((t) => {
    head.appendChild(el("meta", { name: "theme-color", content: t[0], media: t[1] }));
  });
  head.appendChild(el("link", { rel: "stylesheet", href: "assets/docs-theme/fonts/fonts.css" }));
}

/** A visible-on-focus skip link (WCAG 2.4.1) that jumps to the main content. */
export function injectSkipLink() {
  const main = document.getElementById("main");
  if (main && !main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  const skip = el("a", { class: "ff-skip", href: "#main" }, "Skip to content");
  document.body.insertBefore(skip, document.body.firstChild);
}

/**
 * A copy of the fairyfox.io header + the project subnav, in one fixed .ff-top
 * container whose measured height feeds --ff-header-h (so the sidebar + #main
 * clear it). The active item carries aria-current="page".
 */
export function injectHeader() {
  const page = here();

  // Fixed mesh-wide primary nav — identical on every project (docs-site standard
  // 05): Home · Projects · Games · Docs · Updates · About (About last). Don't
  // reorder, drop, or add per project; project-specific links live in the subnav.
  const primary = [
    ["Home", `${HUB}/`, false],
    ["Projects", `${HUB}/projects/`, false],
    ["Games", `${HUB}/games/`, false],
    ["Docs", `${HUB}/docs/`, true],
    ["Updates", `${HUB}/blog/`, false],
    ["About", `${HUB}/about/`, false],
  ]
    .map(
      ([label, href, on]) =>
        `<a href="${href}"${on ? ' class="active" aria-current="page"' : ""}>${label}</a>`,
    )
    .join("");

  const header = el("header", { class: "site-header ff-header", role: "banner" });
  header.innerHTML =
    '<div class="wrap">' +
    `<a class="brand" href="${HUB}/">` +
    `<img class="brand-logo" src="${HUB}/assets/icons/fox.png" alt="" aria-hidden="true">` +
    '<span class="brand-name">Fairy&nbsp;Fox</span></a>' +
    '<nav class="nav" aria-label="Fairy Fox">' +
    primary +
    "</nav>" +
    "</div>";

  const sub = [
    ["Overview", "index.html"],
    ["Project Notes", "tutorial-notes__index.html"],
    ["Systems", "tutorial-notes__systems__index.html"],
    ["Reference", "tutorial-notes__reference__index.html"],
    ["Changelog", "tutorial-notes__version.html"],
    ["API", "global.html"],
    ["Download", "download.html"],
  ]
    .map(([label, href]) => {
      // "API" is active across the whole code-reference area, not just its landing.
      const on = label === "API" ? isApiPage() : href === page;
      return `<a href="${href}"${on ? ' class="active" aria-current="page"' : ""}>${label}</a>`;
    })
    .join("");

  const subnav = el("nav", { class: "subnav ff-subnav", "aria-label": `${NAME} sections` });
  subnav.innerHTML =
    '<div class="wrap">' +
    `<a class="sub-brand" href="index.html">${NAME}</a>` +
    sub +
    '<span class="sep" aria-hidden="true"></span>' +
    `<a class="ext" href="${REPO}">Repository ↗</a>` +
    `<a class="ext" href="${REPO}/tree/main/notes">Notes ↗</a>` +
    "</div>";

  const top = el("div", { class: "ff-top" });
  top.appendChild(header);
  top.appendChild(subnav);
  document.body.insertBefore(top, document.body.firstChild);

  const measure = () =>
    document.documentElement.style.setProperty("--ff-header-h", `${top.offsetHeight}px`);
  measure();
  window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
}

function brandMark() {
  return (
    `<a class="ff-brand" href="${HUB}/">` +
    '<span class="ff-logo" aria-hidden="true">F</span>' +
    "<span>Fairy&nbsp;Fox</span></a>"
  );
}

/** The footer (bottom of #main) — links back to the main site. */
export function injectFooter() {
  const foot = el("footer", { class: "ff-foot" });
  foot.innerHTML =
    '<div class="ff-foot-wrap">' +
    '<div class="ff-foot-brand">' +
    brandMark() +
    `<p>Documentation for ${NAME} — a project under Fairy Fox. ` +
    "Built with JSDoc, themed to match fairyfox.io.</p></div>" +
    '<nav class="ff-foot-col" aria-label="Fairy Fox"><h2>Explore</h2>' +
    `<a href="${HUB}/projects/">Projects</a>` +
    `<a href="${HUB}/docs/">Documentation</a>` +
    `<a href="${HUB}/blog/">Updates</a>` +
    `<a href="${HUB}/about/">About</a></nav>` +
    '<nav class="ff-foot-col" aria-label="This project"><h2>This project</h2>' +
    `<a href="${NODE}">Project node ↗</a>` +
    `<a href="${REPO}">Repository ↗</a>` +
    `<a href="${REPO}/tree/main/notes">Notes ↗</a>` +
    '<a href="index.html">Docs home</a></nav>' +
    "</div>" +
    '<div class="ff-foot-bar"><div class="ff-foot-wrap">' +
    `<span>© ${new Date().getFullYear()} Fairy Fox</span>` +
    `<span>A project under <a href="${HUB}/">Fairy&nbsp;Fox</a></span>` +
    '<span class="spacer"></span>' +
    '<a href="https://github.com/junebug12851">@junebug12851</a>' +
    "</div></div>";
  const main = document.getElementById("main");
  (main || document.body).appendChild(foot);
}
