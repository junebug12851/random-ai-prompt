/**
 * reader.js — the Kindle-style reader-settings menu (the "Aa" button + panel):
 * theme, text size, line spacing and reading width, tuned live and remembered.
 *
 * Prefs live under an ORIGIN-WIDE localStorage key ("fairyfox:reader"), so the
 * choice is SHARED across every same-origin fairyfox.io site (the hub + project
 * docs) — each site just reads the same key. Theme drives data-theme on <html>
 * (overriding prefers-color-scheme in CSS); the rest drive the --reading-* vars.
 * @module docs-theme/reader
 */

import { el } from "./util.js";

const READER_KEY = "fairyfox:reader";
const SIZES = [0.92, 0.99, 1.05, 1.14, 1.24, 1.36]; // rem, stepped by A− / A+
const LH = { tight: 1.6, normal: 1.8, relaxed: 2.05 };
const WIDTH = { narrow: "38rem", normal: "46rem", wide: "56rem" };
const DEFAULTS = { theme: "system", size: 2, lh: "normal", width: "normal" };

let prefs = { ...DEFAULTS };

const clampSize = (n) => Math.max(0, Math.min(SIZES.length - 1, n | 0));

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(READER_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}
function save() {
  try {
    localStorage.setItem(READER_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / storage disabled — ignore */
  }
}
function apply() {
  const root = document.documentElement;
  if (prefs.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.theme);
  root.style.setProperty("--reading-fs", `${SIZES[clampSize(prefs.size)]}rem`);
  root.style.setProperty("--reading-lh", String(LH[prefs.lh] || LH.normal));
  root.style.setProperty("--reading-width", WIDTH[prefs.width] || WIDTH.normal);
}

/** Load + apply saved prefs early (before the chrome paints) to avoid a flash. */
export function loadAndApply() {
  prefs = load();
  apply();
}

function seg(act, labelId, opts) {
  const buttons = opts
    .map(
      ([val, label]) =>
        `<button type="button" data-act="${act}" data-val="${val}">${label}</button>`,
    )
    .join("");
  return `<div class="ff-seg" role="group" aria-labelledby="${labelId}">${buttons}</div>`;
}

/** Build the "Aa" button + settings panel and wire them up (with focus handling). */
export function initReader() {
  prefs = load();
  apply();

  const btn = el("button", {
    class: "ff-reader-btn",
    type: "button",
    "aria-label": "Reading settings",
    "aria-haspopup": "dialog",
    "aria-expanded": "false",
    "aria-controls": "ff-reader-panel",
    title: "Reading settings",
  });
  btn.innerHTML = '<span class="aa-lg">A</span><span class="aa-sm">a</span>';

  const panel = el("div", {
    id: "ff-reader-panel",
    class: "ff-reader-panel",
    role: "dialog",
    "aria-label": "Reading settings",
  });
  panel.innerHTML =
    '<div class="ff-reader-row"><span class="ff-reader-label" id="ff-rl-theme">Theme</span>' +
    seg("theme", "ff-rl-theme", [
      ["system", "Auto"],
      ["light", "Light"],
      ["sepia", "Sepia"],
      ["dark", "Dark"],
    ]) +
    "</div>" +
    '<div class="ff-reader-row"><span class="ff-reader-label" id="ff-rl-size">Text size</span>' +
    '<div class="ff-seg ff-size" role="group" aria-labelledby="ff-rl-size">' +
    '<button type="button" data-act="size-dec" class="aa-min" aria-label="Smaller text">A</button>' +
    '<button type="button" data-act="size-inc" class="aa-max" aria-label="Larger text">A</button>' +
    "</div></div>" +
    '<div class="ff-reader-row"><span class="ff-reader-label" id="ff-rl-lh">Line spacing</span>' +
    seg("lh", "ff-rl-lh", [
      ["tight", "Tight"],
      ["normal", "Normal"],
      ["relaxed", "Relaxed"],
    ]) +
    "</div>" +
    '<div class="ff-reader-row"><span class="ff-reader-label" id="ff-rl-width">Width</span>' +
    seg("width", "ff-rl-width", [
      ["narrow", "Narrow"],
      ["normal", "Normal"],
      ["wide", "Wide"],
    ]) +
    "</div>" +
    '<p class="ff-hint">Text size, spacing &amp; width apply to reading pages. Your choice is remembered across Fairy&nbsp;Fox.</p>';

  const markActive = () => {
    panel.querySelectorAll("button[data-act]").forEach((b) => {
      const act = b.getAttribute("data-act");
      if (act === "theme" || act === "lh" || act === "width")
        b.setAttribute("aria-pressed", b.getAttribute("data-val") === prefs[act] ? "true" : "false");
    });
  };
  markActive();

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.getAttribute("data-act");
    if (act === "theme" || act === "lh" || act === "width") prefs[act] = b.getAttribute("data-val");
    else if (act === "size-dec") prefs.size = clampSize(prefs.size - 1);
    else if (act === "size-inc") prefs.size = clampSize(prefs.size + 1);
    apply();
    save();
    markActive();
  });

  const setOpen = (open) => {
    panel.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.querySelector("button")?.focus();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!panel.classList.contains("open"));
  });
  document.addEventListener("click", (e) => {
    if (panel.classList.contains("open") && !panel.contains(e.target) && e.target !== btn)
      setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      setOpen(false);
      btn.focus();
    }
  });

  const wrap = document.querySelector(".ff-header .wrap");
  (wrap || document.body).appendChild(btn);
  document.body.appendChild(panel);
}
