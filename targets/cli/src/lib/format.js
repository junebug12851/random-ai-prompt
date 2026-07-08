/**
 * @file
 * @brief Output formatting helpers: a simple aligned column table and a JSON printer, so every
 * command can render either human-friendly colored tables or `--json` machine output.
 */
import { c } from "./colors.js";

// ANSI SGR escape matcher (ESC [ ... m), built from the char code so no literal control byte sits in
// the source. Used to measure visible cell width when colors are active.
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * Print a JSON value to stdout (pretty). Used by every command's `--json` mode.
 * @param {*} value The value to serialize.
 * @returns {void}
 */
export function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

/**
 * Strip ANSI color codes so column widths measure visible length.
 * @param {string} s The string.
 * @returns {string} The string without ANSI escapes.
 */
export function stripAnsi(s) {
  return String(s).replace(ANSI_RE, "");
}

/**
 * Render an aligned table of rows. Columns are sized to the widest cell.
 * @param {string[][]} rows The rows (each an array of cell strings).
 * @param {object} [opts]
 * @param {string[]} [opts.head] Optional header cells (rendered bold).
 * @param {number} [opts.indent=0] Left indent in spaces.
 * @returns {string} The rendered table.
 */
export function table(rows, { head, indent = 0 } = {}) {
  const all = head ? [head, ...rows] : rows;
  const widths = [];
  for (const row of all) {
    row.forEach((cell, i) => {
      const len = stripAnsi(String(cell ?? "")).length;
      if (len > (widths[i] || 0)) widths[i] = len;
    });
  }
  const pad = " ".repeat(indent);
  const render = (row, isHead) =>
    pad +
    row
      .map((cell, i) => {
        const s = String(cell ?? "");
        const gap = " ".repeat(Math.max(0, widths[i] - stripAnsi(s).length));
        const text = isHead ? c.subhead(s) : s;
        return i === row.length - 1 ? text : text + gap + "  ";
      })
      .join("");
  const lines = [];
  if (head) lines.push(render(head, true));
  for (const row of rows) lines.push(render(row, false));
  return lines.join("\n");
}

/**
 * A section heading followed by a table.
 * @param {string} title The heading.
 * @param {string[][]} rows The rows.
 * @param {object} [opts] Table opts.
 * @returns {void}
 */
export function section(title, rows, opts) {
  console.log(c.heading(title));
  if (rows.length) console.log(table(rows, { indent: 2, ...opts }));
  else console.log(c.muted("  (none)"));
  console.log("");
}
