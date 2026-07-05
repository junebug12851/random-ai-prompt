/**
 * util.js — shared constants + tiny DOM helpers for the doc-site theme modules.
 * @module docs-theme/util
 */

export const HUB = "https://fairyfox.io";
export const KEY = "random-ai-prompt";
export const NAME = "Random AI Prompt";
export const NODE = `${HUB}/projects/${KEY}/`;
export const REPO = `https://github.com/junebug12851/${KEY}`;

/**
 * Create an element with attributes and optional inner HTML.
 * @param {string} tag
 * @param {Object<string,string>} [attrs]
 * @param {string} [html]
 * @returns {HTMLElement}
 */
export function el(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (html != null) n.innerHTML = html;
  return n;
}

/**
 * The current page's bare filename. docdash writes every page flat into the
 * output dir, so relative links (`index.html`, `tutorial-*.html`) resolve from
 * anywhere; the filename is enough to identify the page.
 * @returns {string}
 */
export function here() {
  return location.pathname.split("/").pop() || "index.html";
}

/**
 * Whether the current page is a code-reference (API) page — the docdash
 * module/global/source pages. Everything else (Overview, notes, Download)
 * renders full-width with no module sidebar.
 * @returns {boolean}
 */
export function isApiPage() {
  const p = here();
  return p !== "index.html" && p !== "download.html" && p.indexOf("tutorial-") !== 0;
}
