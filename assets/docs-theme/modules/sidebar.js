/**
 * sidebar.js — tidies docdash's generated content: prunes the module sidebar's
 * redundant entries and de-duplicates the tutorial page titles.
 * @module docs-theme/sidebar
 */

import { here } from "./util.js";

/**
 * Trim redundant entries from docdash's sidebar now that the header + subnav
 * carry that navigation: the "Home" link (= Overview) and the "Tutorials"
 * section (moved to the subnav). ("GitHub" is dropped in jsdoc.config.json.)
 */
export function pruneSidebar() {
  const nav = document.querySelector("body > nav");
  if (!nav) return;
  const home = nav.querySelector('h2 a[href="index.html"]');
  if (home) home.closest("h2")?.remove();
  nav.querySelectorAll("h3").forEach((h) => {
    if (h.textContent.trim().toLowerCase() === "tutorials") {
      const ul = h.nextElementSibling;
      h.remove();
      if (ul && ul.tagName === "UL") ul.remove();
    }
  });
}

/**
 * On the notes tutorial pages docdash prints the title twice — the
 * "Tutorial: <title>" page heading AND a duplicate <h2> in the tutorial header.
 * Drop the "Tutorial:" prefix (these are project notes) and remove the duplicate
 * <h2>, leaving one clean title (plus the child list on hub pages).
 */
export function tidyTutorialTitle() {
  if (here().indexOf("tutorial-") !== 0) return;
  const pt = document.querySelector("#main h1.page-title");
  if (!pt) return;
  const title = pt.textContent.replace(/^\s*Tutorial:\s*/, "").trim();
  pt.textContent = title;
  document.querySelectorAll("#main header h2").forEach((h) => {
    if (h.textContent.trim() === title) {
      const hdr = h.parentNode;
      h.remove();
      if (hdr && hdr.tagName === "HEADER" && !hdr.querySelector("ul,ol,p,h1,h2,h3")) hdr.remove();
    }
  });
}
