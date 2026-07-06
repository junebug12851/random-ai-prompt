/**
 * @file
 * @brief DPL (Dynamic Prompt Language) compiler entry point: front-matter + parse + render
 * wired into a block module object. The parser, renderer, intensity/focus math, word
 * scales, and default RNG live in sibling modules (`parser.js`, `renderer.js`, `intensity.js`,
 * `words.js`, `rng.js`). See notes/reference/dpl-design.md.
 */

// DPL is the v3 authoring language for blocks: a Markdown-shaped, data-not-code
// description of "what to maybe say", evaluated as a tree of weighted LAYERS. A file is a
// layer; each section is a layer; each line is a layer. Weights are LOCAL sort keys
// (lower = rendered earlier) — a layer only reorders its own children and never the parent.
// `compileDpl(source, bridge)` returns the same shape as a JS generator module
// (`{ default, suggestion_exclude }`) so the existing engine/loader are untouched.
//
// Plain text is valid DPL (every line is just an always-on layer), so the prompt box and the
// generator files share one language. See notes/reference/dpl-design.md for the full spec and
// notes/plans/v3-layers.md for the engine model.

import { parseFrontMatter, lexLines, parseSections } from "./parser.js";
import { renderNodes } from "./renderer.js";
import { clampIntensity, clampFocus } from "./intensity.js";
import { RNG } from "./rng.js";

// `intensityWord` is part of this module's public surface (the emphasis stage imports it from here);
// re-export it from the word-scale module so existing importers keep working.
export { intensityWord } from "./words.js";

// ---------------------------------------------------------------------------
// Compile: source -> { default, suggestion_exclude }
// ---------------------------------------------------------------------------

/**
 * Compile a `.dpl` source into a block module object (same shape as a JS generator).
 * @param {string} source The `.dpl` file text.
 * @param {object} [bridge] Optional JS bridge: `{ resolveJs(path, ctx) }` for `{js:}` / `insert js:` / `script`.
 * @returns {{default: Function, suggestion_exclude: boolean, stacking: boolean, meta: object}} The module.
 */
export function compileDpl(source, bridge = null) {
  const { meta, body } = parseFrontMatter(source);
  const sections = parseSections(lexLines(body));
  const suggestion_exclude = meta.suggestions === "off" || meta.suggestions === "false";
  // A `stacking` (alias `multi`) generator opts OUT of global single-layer dedup: it may be imported
  // and rendered more than once (the many decorative fragments that garnish several clauses). Default
  // is singular — see notes/reference/layering-design.md.
  const stacking =
    meta.stacking === "true" ||
    meta.stacking === true ||
    meta.multi === "true" ||
    meta.multi === true;

  function makeCtx(settings, imageSettings, upscaleSettings, intensity, focus) {
    const ctx = {
      settings,
      imageSettings,
      upscaleSettings,
      intensity: clampIntensity(intensity),
      focus: clampFocus(focus),
      rng: RNG,
      bridge,
      hasSection: (name) => Object.hasOwn(sections, name),
      section: (name) => (sections[name] ? renderNodes(sections[name], ctx) : ""),
      // JS->DPL bridge calls (return rendered strings).
      prompt: (name) => bridge?.runPrompt?.(name, ctx) ?? `{#${String(name).replace(/^#/, "")}}`,
      list: (name) => bridge?.runList?.(name, ctx) ?? `{${name}}`,
      expand: (snippet) => bridge?.expand?.(snippet, ctx) ?? snippet,
    };
    return ctx;
  }

  function defaultFn(settings, imageSettings, upscaleSettings, intensity, focus) {
    const ctx = makeCtx(
      settings ?? {},
      imageSettings ?? {},
      upscaleSettings ?? {},
      intensity,
      focus,
    );
    if (meta.script) return bridge?.resolveJs?.(meta.script, ctx) ?? "";
    return ctx.section("Start");
  }

  // `Auto Begin` / `Auto End`: optional sections a block can declare to contribute framing that the
  // app folds into the START / END of the whole prompt (alongside the user wrapper). They render
  // exactly like any section (probability, refs, JS), but are NOT part of the block's own `Start`
  // body. See notes/plans/v3-layers.md.
  const has = (name) => Object.hasOwn(sections, name);
  const renderSection = (name) => (settings, imageSettings, upscaleSettings, intensity, focus) => {
    if (!has(name)) return "";
    return makeCtx(
      settings ?? {},
      imageSettings ?? {},
      upscaleSettings ?? {},
      intensity,
      focus,
    ).section(name);
  };

  return {
    default: defaultFn,
    suggestion_exclude,
    stacking,
    meta,
    hasAutoBegin: has("Auto Begin"),
    hasAutoEnd: has("Auto End"),
    autoBegin: renderSection("Auto Begin"),
    autoEnd: renderSection("Auto End"),
  };
}

export default compileDpl;
