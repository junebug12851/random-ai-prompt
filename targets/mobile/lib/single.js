/**
 * @file Single-view helpers for the mobile target — the phone counterpart of the web's
 * `frontend/lib/gallery.js` + `lib/single/*`. Turns a saved image's stored metadata (index.json
 * entry) into the layered prompt/negative views, the curated details table, a clickable keyword
 * cloud, parent→children ancestry, and the Markdown export the Single screen renders. Kept UI-free
 * so it can be unit-checked and asserted by the parity gate.
 */

/**
 * Normalize a saved image's prompt to `{ dpl, roll, ai, final }`, accepting the enriched shape
 * (`meta.layers`) and the older flat shape (a bare `prompt` string → treated as the sent `final`).
 * @param {object} meta The index.json entry.
 * @returns {{dpl: ?string, roll: ?string, ai: ?string, final: ?string}}
 */
export function promptLayers(meta) {
  const m = meta || {};
  if (m.layers && typeof m.layers === "object") {
    return { dpl: m.layers.dpl ?? null, roll: m.layers.roll ?? null, ai: m.layers.ai ?? null, final: m.layers.final ?? null };
  }
  return { dpl: null, roll: null, ai: null, final: m.prompt ?? null };
}

/**
 * Normalize a saved image's negative prompt to `{ dpl, roll, ai, final }` (enriched or flat).
 * @param {object} meta The index.json entry.
 * @returns {{dpl: ?string, roll: ?string, ai: ?string, final: ?string}}
 */
export function negativeLayers(meta) {
  const m = meta || {};
  if (m.negativeLayers && typeof m.negativeLayers === "object") {
    return {
      dpl: m.negativeLayers.dpl ?? null,
      roll: m.negativeLayers.roll ?? null,
      ai: m.negativeLayers.ai ?? null,
      final: m.negativeLayers.final ?? null,
    };
  }
  return { dpl: null, roll: null, ai: null, final: m.negative || null };
}

/** A display size string from a provider-settings snapshot (size / imageSize / aspectRatio / W×H). */
export function sizeFromSettings(s) {
  if (!s) return "";
  if (s.size) return String(s.size);
  if (s.imageSize) return String(s.imageSize);
  if (s.aspectRatio) return String(s.aspectRatio);
  if (s.width && s.height) return `${s.width}×${s.height}`;
  return "";
}

/** The best single prompt string to label an image with (final → AI → roll → DPL). */
export function promptText(item) {
  const p = promptLayers(item?.meta || item);
  return p.final || p.ai || p.roll || p.dpl || "";
}

/** First present value among several possible setting keys (providers name things differently). */
export function pick(s, ...keys) {
  for (const k of keys) if (s && s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
  return undefined;
}

// Keys already surfaced in the curated details table (excluded from the "All settings" dump).
const SHOWN_KEYS = new Set([
  "width", "height", "model", "modelName", "checkpoint", "sd_model", "sd_model_hash",
  "sampler", "samplerName", "sampler_name", "scheduler", "steps", "numSteps", "cfg",
  "cfgScale", "cfg_scale", "guidance", "guidanceScale", "seed", "negativePrompt", "prompt",
  "mode", "backendUrl", "negativePromptText",
]);

/**
 * Build the curated label/value detail rows for an image (empty values dropped), plus the leftover
 * provider settings for the collapsible "All settings" section.
 * @param {object} item A gallery item (`{ name, uri, meta:{...} }` or the flat legacy entry).
 * @returns {{rows: Array<[string,string]>, rest: Array<[string,string]>}}
 */
export function buildDetails(item) {
  const m = item?.meta || item || {};
  const s = m.settings || {};
  const size =
    m.size ||
    (pick(s, "width") && pick(s, "height") ? `${pick(s, "width")}×${pick(s, "height")}` : undefined);
  const saved = m.createdAt ? new Date(m.createdAt).toLocaleString() : undefined;
  const rows = [
    ["Provider", m.providerLabel || m.provider],
    ["Model", m.model || pick(s, "model", "modelName", "checkpoint", "sd_model", "sd_model_hash")],
    ["Sampler", pick(s, "sampler", "samplerName", "sampler_name", "scheduler")],
    ["Steps", pick(s, "steps", "numSteps")],
    ["CFG", pick(s, "cfg", "cfgScale", "cfg_scale", "guidance", "guidanceScale")],
    ["Size", size],
    ["Seed", m.seed ?? pick(s, "seed")],
    ["Saved", saved],
    ["File", item?.name],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  const rest = Object.entries(s).filter(
    ([k, v]) => !SHOWN_KEYS.has(k) && v !== null && v !== "" && typeof v !== "object",
  );
  return { rows, rest };
}

/**
 * Parse clean, clickable keyword tags out of a prompt (strips DPL/weight syntax, dedupes). Mirrors
 * the spirit of the web's `parseKeywords` without its full CodeMirror-aware tokenizer.
 * @param {string} text The sent-to-model prompt.
 * @returns {string[]} Display tags.
 */
export function parseKeywords(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (let raw of String(text).split(/[,\n]+/)) {
    let t = raw
      .replace(/[{}[\]()<>|]/g, " ") // DPL / attention brackets
      .replace(/:\s*-?\d*\.?\d+/g, " ") // weights like :1.2
      .replace(/\s+/g, " ")
      .trim();
    if (!t || t.length < 2 || /^-?\d+$/.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 80) break;
  }
  return out;
}

/**
 * Annotate items with parent→children ancestry (a child names its `parent` = the parent image's
 * name). Returns a new array; each item gains `children: [{ name, uri, kind, source }]`.
 * @param {object[]} items The feed (each `{ name, uri, ...meta }`).
 * @returns {object[]}
 */
export function linkChildren(items) {
  const present = new Set(items.map((it) => it.name));
  const kids = new Map();
  for (const it of items) {
    const parent = it.parent;
    if (parent && present.has(parent)) {
      if (!kids.has(parent)) kids.set(parent, []);
      kids.get(parent).push({
        name: it.name,
        uri: it.uri,
        kind: it.derivedKind || "variation",
        source: it.derivedSource || null,
      });
    }
  }
  return items.map((it) => ({ ...it, children: kids.get(it.name) || [] }));
}

/** Lowercase searchable haystack for an item (every prompt/negative layer + provider + file). */
export function searchHaystack(item) {
  const p = promptLayers(item);
  const n = negativeLayers(item);
  return [
    p.final, p.roll, p.ai, p.dpl, n.final, n.roll, n.ai, n.dpl,
    Array.isArray(item.keywords) ? item.keywords.join(" ") : null,
    item.providerLabel, item.provider, item.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * A copy-ready Markdown block for an image (prompt / negative / details), mirroring the web's
 * `toMarkdown`.
 * @param {string} prompt The sent prompt.
 * @param {string} negative The sent negative prompt.
 * @param {Array<[string,string]>} details The detail rows.
 * @returns {string}
 */
export function toMarkdown(prompt, negative, details) {
  const lines = [];
  if (prompt) lines.push(`**Prompt**\n\n${prompt}`);
  if (negative) lines.push(`**Negative**\n\n${negative}`);
  if (details && details.length) {
    lines.push(
      ["| Field | Value |", "| --- | --- |", ...details.map(([k, v]) => `| ${k} | ${v} |`)].join("\n"),
    );
  }
  return lines.join("\n\n");
}
