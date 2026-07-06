/**
 * @file One-shot: migrate v2 block generators from the bare `#name` sigil to
 * the brace-delimited `{#name}` form (uniform with `{list}` / `<expansion>`, and able to
 * carry `/` paths). Only rewrites prompt CONTENT — `#token` on non-comment lines — leaving
 * JSDoc/`//` comments alone, and is idempotent (`(?<!\{)` guard skips already-wrapped
 * tokens). v1 generators have no internal `#` references, so they are not touched.
 * Re-runnable.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "data", "blocks", "v2");

// `#name` -> `{#name}`, but only a real token (letter-led, word/hyphen/slash chars) and
// not one already wrapped in a brace (idempotent).
const TOKEN = /(?<!\{)#([A-Za-z][\w/-]*)/g;
const isComment = (line) =>
  /^\s*(\*|\/\/)/.test(line) || /@(file|brief|returns|param|module)/.test(line);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

let changed = 0;
let refs = 0;
for (const file of walk(root)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let touched = false;
  const next = lines.map((line) => {
    if (isComment(line)) return line;
    return line.replace(TOKEN, (m, name) => {
      refs++;
      touched = true;
      return `{#${name}}`;
    });
  });
  if (touched) {
    fs.writeFileSync(file, next.join("\n"));
    changed++;
  }
}
console.log(`migrated ${refs} #token references in ${changed} v2 generators to {#name}`);
