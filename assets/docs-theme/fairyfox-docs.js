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
  if (!isApiPage()) root.classList.add("ff-no-sidebar");
  if (here() === "download.html") root.classList.add("ff-download");

  injectHead();
  injectSkipLink();
  injectHeader();
  injectFooter();
  pruneSidebar();
  tidyTutorialTitle();
  initReader();
}

// type="module" scripts are deferred, so the DOM is usually ready; guard anyway.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
else run();
