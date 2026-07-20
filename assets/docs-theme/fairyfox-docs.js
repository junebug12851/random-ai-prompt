/**
 * fairyfox-docs.js — the doc-site theme entry (an ES module).
 *
 * Loaded by docdash as <script type="module"> (the build post-processes the tag).
 * It wraps the generated docdash site in the fairyfox.io shell — a copy of the
 * hub header, the project subnav, a footer, the reader-settings menu and the
 * self-hosted fonts — and tidies docdash's output. The heavy lifting lives in
 * small focused modules under ./modules/; styling is in fairyfox-docs.css
 * (which @imports ./theme/*.css).
 * @module docs-theme
 */

import { here, isApiPage } from "./modules/util.js";
import { injectHead, injectSkipLink, injectHeader, injectFooter } from "./modules/chrome.js";
import { pruneSidebar, tidyTutorialTitle } from "./modules/sidebar.js";
import { loadAndApply, initReader } from "./modules/reader.js";

function run() {
  const root = document.documentElement;
  if (root.hasAttribute("data-ff-themed")) return;
  root.setAttribute("data-ff-themed", "");

  // Apply saved reading prefs first so the theme doesn't flash.
  loadAndApply();
  // The module sidebar shows only on API pages; the Download page is a wide layout.
  // (These classes are also set inline in <head> at build time to avoid a
  // first-paint flash; re-adding here is idempotent and a fallback.)
  if (!isApiPage()) root.classList.add("ff-no-sidebar");
  if (here() === "index.html") root.classList.add("ff-home");
  if (here() === "download.html") root.classList.add("ff-download");

  injectHead();
  injectSkipLink();
  injectHeader();
  injectFooter();
  pruneSidebar();
  tidyTutorialTitle();
  initReader();

  // Coins: the shared reading-engagement counter. modules/coins.js is vendored
  // VERBATIM from the hub chrome master (the earning engine must not be
  // reimplemented) and loaded AFTER the header + reader exist, so its button
  // lands just left of the "Aa" reader button. It's a classic IIFE exposing
  // window.FairyFoxCoins, so it's injected as a plain <script>, not imported.
  // See notes/reference/coins.md.
  const coins = document.createElement("script");
  coins.src = new URL("./modules/coins.js", import.meta.url).href;
  coins.defer = true;
  document.head.appendChild(coins);
}

// type="module" scripts are deferred, so the DOM is usually ready; guard anyway.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
else run();
