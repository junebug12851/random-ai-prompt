/**
 * A lightweight, position-aware DPL validator that powers the editor's live status icon and the
 * inline error spots. It is intentionally lenient (plain text is valid DPL) and only flags things
 * that are genuinely wrong: an unclosed front-matter fence, mixed/!inconsistent indentation, an
 * unclosed `{list}` / `{#gen}` token, unbalanced emphasis brackets, and a `go to` that targets a
 * section the block doesn't define. As a backstop it also runs the real `compileDpl`, surfacing any
 * thrown parse error.
 *
 * Returns flat diagnostics `{ from, to, severity, message }` over the source offsets, so both the
 * React status icon (counts errors) and the CodeMirror decoration plugin (underlines ranges) read
 * from one source of truth.
 * @module gui/lib/dpl/validateDpl
 */
import compileDpl from "../../../../src/core/dpl/dpl.js";

/** @typedef {{ from: number, to: number, severity: "error"|"warning", message: string }} DplDiagnostic */

/** Count consecutive `open` then non-matching → returns the column of the first unbalanced char, or -1 if balanced (and >0 still-open count via the second element). */
function scanBalance(code, open, close) {
  let depth = 0;
  for (let c = 0; c < code.length; c++) {
    if (code[c] === open) depth++;
    else if (code[c] === close) {
      depth--;
      if (depth < 0) return { extraClose: c, open: 0 };
    }
  }
  return { extraClose: -1, open: depth };
}

/**
 * Validate DPL source.
 * @param {string} text The DPL text.
 * @returns {DplDiagnostic[]} The diagnostics (empty when clean).
 */
export function validateDpl(text) {
  /** @type {DplDiagnostic[]} */
  const diags = [];
  if (typeof text !== "string" || text === "") return diags;

  const lines = text.split("\n");
  const lineStart = [];
  let off = 0;
  for (const ln of lines) {
    lineStart.push(off);
    off += ln.length + 1;
  }
  const at = (i, severity, message, fromCol = 0, toCol = null) => {
    const from = lineStart[i] + Math.max(0, fromCol);
    const end = toCol == null ? lineStart[i] + lines[i].length : lineStart[i] + toCol;
    diags.push({ from, to: Math.max(end, from + 1), severity, message });
  };

  // Front matter must close if it opens.
  if (lines[0]?.trim() === "---") {
    let closed = false;
    for (let i = 1; i < lines.length; i++)
      if (lines[i].trim() === "---") {
        closed = true;
        break;
      }
    if (!closed) at(0, "error", "Front matter opened with --- but never closed.");
  }

  // Section names: a text line immediately followed by an `===` underline.
  const sections = new Set();
  for (let i = 0; i < lines.length - 1; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith(";") && /^={3,}$/.test(lines[i + 1].trim()))
      sections.add(t.replace(/\s*\[.*$/, "").trim());
  }

  let indentChar = null; // the file's first-seen indent char (tab or space)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const semi = raw.indexOf(";"); // DPL has no string literals, so a `;` always starts a comment
    const code = semi >= 0 ? raw.slice(0, semi) : raw;
    if (code.trim() === "") continue;

    // Indentation: never mix tabs and spaces; stick to whatever the file started with.
    const indent = code.match(/^[ \t]*/)[0];
    if (indent.includes("\t") && indent.includes(" ")) {
      at(i, "error", "Mixed tabs and spaces in the indentation — use one or the other.", 0, indent.length);
    } else if (indent.length > 0) {
      if (indentChar === null) indentChar = indent[0];
      else if (indent[0] !== indentChar)
        at(
          i,
          "error",
          `Indented with ${indent[0] === "\t" ? "a tab" : "spaces"}, but the file started indenting with ${indentChar === "\t" ? "tabs" : "spaces"}.`,
          0,
          indent.length,
        );
    }

    // `{list}` / `{#gen}` tokens must open and close on the same line.
    const br = scanBalance(code, "{", "}");
    if (br.extraClose >= 0) at(i, "error", "A '}' with no matching '{'.", br.extraClose, br.extraClose + 1);
    else if (br.open > 0) at(i, "error", "Unclosed '{' — a {list} or {#generator} token must close on the same line.");

    // Emphasis brackets should balance (a warning — prose occasionally has a lone bracket).
    for (const [o, c, name] of [
      ["(", ")", "parenthesis"],
      ["[", "]", "bracket"],
    ]) {
      const b = scanBalance(code, o, c);
      if (b.extraClose >= 0) at(i, "warning", `Unbalanced '${c}' ${name}.`, b.extraClose, b.extraClose + 1);
      else if (b.open > 0) at(i, "warning", `Unbalanced '${o}' ${name}.`);
    }

    // `go to <Section>` must target a section this block defines.
    const m = code.match(/^\s*(?:-\s*)?go\s+to\s+(.+?)\s*$/i);
    if (m) {
      const target = m[1].replace(/\s*\[.*$/, "").trim();
      if (target && !sections.has(target)) {
        const col = code.indexOf(target);
        at(i, "error", `"go to ${target}" — this block has no section named "${target}".`, col, col + target.length);
      }
    }
  }

  // Backstop: surface any error the real compiler throws.
  try {
    compileDpl(text);
  } catch (e) {
    diags.push({ from: 0, to: Math.min(text.length, 1) || 1, severity: "error", message: `Parse error: ${e.message}` });
  }

  return diags;
}

/**
 * @param {string} text DPL source.
 * @returns {{ errors: number, warnings: number, diagnostics: DplDiagnostic[] }} A small summary.
 */
export function dplStatus(text) {
  const diagnostics = validateDpl(text);
  let errors = 0;
  let warnings = 0;
  for (const d of diagnostics) (d.severity === "error" ? errors++ : warnings++);
  return { errors, warnings, diagnostics };
}

export default validateDpl;
