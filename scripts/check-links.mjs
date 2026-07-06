/**
 * @file
 * @brief Broken-link checker for the Markdown docs. Fails (exit 1) if any relative link in a tracked
 * `.md` file points at a path that doesn't exist. This is the mechanical guard against documentation
 * drift: when a file/feature is renamed or removed, any doc that linked to it turns into a broken link
 * and this check turns red — so stale references can't silently pile up. Wired into `npm test` + CI.
 *
 * Run: `npm run check:docs`  (or: `node scripts/check-links.mjs`)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Generated / vendored / runtime trees never contain source docs we author — skip them.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "docs", // generated JSDoc site
  "dist",
  "output",
  "coverage",
  "tmp", // build-docs staging (generated tutorial HTML)
  ".netlify",
  "test-results",
  "playwright-report",
  ".lighthouseci",
  "assets", // includes the read-only reference clones under assets/references/
  "app", // the desktop target's staged runtime payload (built by stage.mjs — copies of authored docs)
  "gen", // Tauri-generated files under targets/web-shell/
  "dist-ssr", // throwaway SSR bundle from the online web build
  "target", // Rust/Cargo build output (targets/web-shell/target)
]);

// Intentional *illustrative* link targets (teaching link syntax in the docs) — not real files.
const ALLOW = new Set(["foo.md", "sibling.md"]);

/** Recursively collect every `.md` file under `dir`, skipping SKIP_DIRS. */
function collectMarkdown(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out = out.concat(collectMarkdown(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const linkRe = /\]\(([^)]+)\)/g;
const broken = [];
let checked = 0;

for (const file of collectMarkdown(root)) {
  const md = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  let m;
  while ((m = linkRe.exec(md))) {
    let target = m[1].trim();
    // External / anchor / mail links are out of scope.
    if (/^(https?:|mailto:|#|tel:|data:)/i.test(target)) continue;
    // Strip a trailing #anchor and any surrounding <> or "title".
    target = target.replace(/^<|>$/g, "").split(/\s+/)[0];
    const noAnchor = target.split("#")[0];
    if (!noAnchor) continue; // pure in-page anchor
    if (ALLOW.has(path.basename(noAnchor))) continue;
    checked++;
    const abs = path.resolve(dir, decodeURIComponent(noAnchor));
    if (!fs.existsSync(abs)) {
      broken.push(`${path.relative(root, file)}  →  ${m[1]}`);
    }
  }
}

if (broken.length) {
  console.error(
    `✗ ${broken.length} broken doc link(s) found (checked ${checked} relative links):\n`,
  );
  for (const b of broken) console.error("  " + b);
  console.error(
    "\nA broken link usually means a file was renamed/moved/removed but a doc still points at the old path.\n" +
      "Fix the link (or the doc) so references stay accurate. See notes/reference/repo-hygiene.md.",
  );
  process.exit(1);
}

console.log(`✓ doc links OK — ${checked} relative links across the Markdown docs all resolve.`);
