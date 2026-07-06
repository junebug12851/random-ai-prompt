/**
 * reader.js — the reading-appearance menu (the "Aa" button + panel): theme,
 * accent colour, text size, line spacing and reading width, tuned live and
 * remembered — modelled on Apple Books / Kindle.
 *
 * Theme is a row of weather/time icon buttons (sun = Light, sunset = Sepia,
 * moon = Dark) plus an "Auto" toggle in the section header (follow the OS).
 * Accent is a row of colour dots with a "reset to theme default" swatch. Text
 * size is a slider (small A → large A) that scales the document ROOT font-size,
 * so it resizes the whole UI on every page. Line spacing drives body
 * line-height; width caps the reading measure.
 *
 * Prefs live under a VERSIONED origin-wide localStorage key
 * ("fairyfox:reader:b"), so the choice is SHARED across every same-origin
 * fairyfox.io site (the hub + project docs) — each site just reads the same key.
 * loadAndApply() runs early (before the chrome paints) to avoid a flash.
 * @module docs-theme/reader
 */

import { el } from "./util.js";

const READER_KEY = "fairyfox:reader:b";
const SIZES = [15, 16.5, 18, 20, 22]; // root px, slider 0..4
const LH = { tight: 1.5, normal: 1.65, relaxed: 1.9 };
const WIDTH = { narrow: "38rem", normal: "46rem", wide: "58rem" };
// Curated, distinct accent hues (refined — not neon, no duplicate oranges).
const ACCENTS = [
  ["#e0573f", "Coral"],
  ["#cf7f22", "Ochre"],
  ["#3f9e63", "Green"],
  ["#2a9ca0", "Teal"],
  ["#4478c9", "Blue"],
  ["#7d68c8", "Indigo"],
  ["#c9508a", "Rose"],
];
const ACCENT_VARS = [
  "--accent",
  "--violet",
  "--violet-deep",
  "--accent-ink",
  "--link",
  "--link-hover",
  "--glow",
];
const DEFAULTS = { theme: "system", accent: null, size: 1, lh: "normal", width: "normal" };

let prefs = { ...DEFAULTS };

const clampSize = (n) => Math.max(0, Math.min(SIZES.length - 1, n | 0));

const svg = (inner) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  inner +
  "</svg>";
const ICON = {
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ),
  sunset: svg(
    '<path d="M17 17a5 5 0 0 0-10 0"/><path d="M12 3v3M4.5 9.5l1.5 1.5M18 11l1.5-1.5M2 17h3M19 17h3"/><path d="M3 21h18"/>',
  ),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'),
};
const RESET_ICON =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" ' +
  'stroke="currentColor" stroke-width="2"/><line x1="6.6" y1="17.4" x2="17.4" y2="6.6" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const THEME_BTNS = [
  ["light", "Light", "sun"],
  ["sepia", "Sepia", "sunset"],
  ["dark", "Dark", "moon"],
];

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

function applyAccent(root, hex) {
  if (!hex) {
    ACCENT_VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }
  const ink = `color-mix(in srgb, ${hex}, var(--text) 42%)`;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--violet", hex);
  root.style.setProperty("--violet-deep", `color-mix(in srgb, ${hex}, #000 12%)`);
  root.style.setProperty("--accent-ink", ink);
  root.style.setProperty("--link", ink);
  root.style.setProperty("--link-hover", `color-mix(in srgb, ${hex}, var(--text) 26%)`);
  root.style.setProperty("--glow", `color-mix(in srgb, ${hex} 40%, transparent)`);
}
function apply() {
  const root = document.documentElement;
  if (prefs.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.theme);
  root.style.fontSize = `${SIZES[clampSize(prefs.size)]}px`;
  root.style.setProperty("--reading-lh", String(LH[prefs.lh] || LH.normal));
  root.style.setProperty("--reading-width", WIDTH[prefs.width] || WIDTH.normal);
  applyAccent(root, prefs.accent);
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

  const themeBtns = THEME_BTNS.map(
    (t) =>
      `<button type="button" class="ff-theme-ic" data-act="theme" data-val="${t[0]}" ` +
      `title="${t[1]}" aria-label="${t[1]}">${ICON[t[2]]}<span class="cap">${t[1]}</span></button>`,
  ).join("");

  const swatches =
    '<button type="button" class="ff-swatch ff-swatch-default" data-acc="" ' +
    `aria-label="Theme default accent" title="Theme default">${RESET_ICON}</button>` +
    ACCENTS.map(
      (a) =>
        `<button type="button" class="ff-swatch" data-acc="${a[0]}" style="--sw:${a[0]}" ` +
        `aria-label="${a[1]} accent" title="${a[1]}"></button>`,
    ).join("");

  panel.innerHTML =
    '<div class="ff-rp-head"><span class="ff-rp-title">Reading settings</span>' +
    '<button type="button" class="ff-rp-close" data-act="close" aria-label="Close">×</button></div>' +
    '<div class="ff-rp-sec"><div class="ff-rp-schead"><span class="ff-rp-label" id="ff-rl-theme">Theme</span>' +
    '<button type="button" class="ff-auto" data-act="theme" data-val="system"><span class="dot"></span>Auto</button></div>' +
    '<div class="ff-theme-seg" role="group" aria-labelledby="ff-rl-theme">' +
    themeBtns +
    "</div></div>" +
    '<div class="ff-rp-sec"><span class="ff-rp-label" id="ff-rl-accent">Accent</span>' +
    '<div class="ff-swatches" role="group" aria-labelledby="ff-rl-accent">' +
    swatches +
    "</div></div>" +
    '<div class="ff-rp-sec"><span class="ff-rp-label" id="ff-rl-size">Text size</span>' +
    '<div class="ff-size-row"><span class="a-end a-min" aria-hidden="true">A</span>' +
    `<input type="range" class="ff-range" min="0" max="${SIZES.length - 1}" step="1" ` +
    `value="${clampSize(prefs.size)}" aria-label="Text size">` +
    '<span class="a-end a-max" aria-hidden="true">A</span></div></div>' +
    '<div class="ff-rp-sec"><span class="ff-rp-label" id="ff-rl-lh">Line spacing</span>' +
    seg("lh", "ff-rl-lh", [
      ["tight", "Tight"],
      ["normal", "Normal"],
      ["relaxed", "Relaxed"],
    ]) +
    "</div>" +
    '<div class="ff-rp-sec"><span class="ff-rp-label" id="ff-rl-width">Width</span>' +
    seg("width", "ff-rl-width", [
      ["narrow", "Narrow"],
      ["normal", "Normal"],
      ["wide", "Wide"],
    ]) +
    "</div>" +
    '<div class="ff-rp-foot"><p class="ff-rp-hint">Saved &amp; shared across Fairy&nbsp;Fox.</p>' +
    '<button type="button" class="ff-rp-reset" data-act="reset">Reset</button></div>';

  const range = panel.querySelector(".ff-range");

  const markActive = () => {
    panel.querySelectorAll("[data-act], .ff-swatch").forEach((b) => {
      const act = b.getAttribute("data-act");
      let on = null;
      if (b.classList.contains("ff-swatch")) on = b.getAttribute("data-acc") === (prefs.accent || "");
      else if (act === "theme" || act === "lh" || act === "width")
        on = b.getAttribute("data-val") === prefs[act];
      if (on !== null) b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (range) range.value = clampSize(prefs.size);
  };
  markActive();

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !panel.contains(b)) return;
    if (b.classList.contains("ff-swatch")) {
      prefs.accent = b.getAttribute("data-acc") || null;
    } else {
      const act = b.getAttribute("data-act");
      if (act === "close") {
        setOpen(false);
        btn.focus();
        return;
      }
      if (act === "reset") prefs = { ...DEFAULTS };
      else if (act === "theme" || act === "lh" || act === "width")
        prefs[act] = b.getAttribute("data-val");
      else return;
    }
    apply();
    save();
    markActive();
  });
  range.addEventListener("input", () => {
    prefs.size = clampSize(+range.value);
    apply();
    save();
  });

  const setOpen = (open) => {
    panel.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.querySelector(".ff-rp-close")?.focus();
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

  // Reader button sits at the far right of the header, just AFTER the primary
  // nav (past "About"), still a direct child of the header wrap so it stays
  // visible when the nav collapses. The panel is appended to <body>.
  const wrap = document.querySelector(".ff-header .wrap");
  const nav = wrap && wrap.querySelector(".nav");
  if (wrap && nav) nav.parentNode.insertBefore(btn, nav.nextSibling);
  else (wrap || document.body).appendChild(btn);
  document.body.appendChild(panel);
}
