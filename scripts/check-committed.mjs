/**
 * @file
 * @brief `npm run check:committed` — assert that what you're about to call "green" is what you
 * actually COMMITTED, not what happens to be sitting in your working tree.
 *
 * ## Why this exists
 *
 * On 2026-07-11 four commits (2.55.0 … 2.57.0) shipped a **broken web build**. A file was moved to
 * `engine/`, its importers were updated on disk — and a multi-path `git add` silently staged only some
 * of what was listed (13 files, not 17). The importer fixes never got committed.
 *
 * Every gate then passed. Of course they did: `npm test`, the build, the parity checks all read the
 * **working tree**, which had the fixes. The committed tree — the thing that was pushed, the thing CI
 * and every other clone would see — did not build:
 *
 *     [UNRESOLVED_IMPORT] Could not resolve '../lib/manage/listEditorOps.js'
 *
 * A working tree is not evidence. This check makes that concrete: it fails when tracked source files
 * differ from HEAD, so "the suite is green" can't be claimed over an uncommitted fix.
 *
 * It deliberately ignores line-ending-only churn (this repo shows 100+ CRLF-phantom modifications) by
 * asking git for a real numstat and dropping `0 0` entries.
 *
 * Run: `node scripts/check-committed.mjs` (in `npm test`).
 *   --verbose  list every differing file, not just the source ones.
 */
import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

// Files whose content can change what a build/test run produces. Docs/notes churn is fine — it can't
// make a green suite lie about the code.
const SOURCE = /\.(js|jsx|mjs|cjs|ts|tsx|json|css|html)$/;
const IGNORE = /^(notes\/|docs\/|artifacts\/)/;

const verbose = process.argv.includes("--verbose");

// numstat vs HEAD: "added<TAB>deleted<TAB>path". A pure line-ending change reports 0/0.
const rows = git("diff", "HEAD", "--numstat")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"))
  .filter(([add, del]) => !(add === "0" && del === "0"))
  .map(([add, del, path]) => ({ add, del, path }));

const dirtySource = rows.filter((r) => SOURCE.test(r.path) && !IGNORE.test(r.path));

if (!dirtySource.length) {
  const extra = rows.length
    ? ` (${rows.length} non-source file(s) differ — docs/notes, harmless)`
    : "";
  console.log(`✓ check:committed — the working tree's source matches HEAD${extra}.`);
  if (verbose && rows.length) for (const r of rows) console.log(`    ~ ${r.path}`);
  process.exit(0);
}

console.error(
  `✗ check:committed — ${dirtySource.length} SOURCE file(s) differ from HEAD.\n\n` +
    `  A passing test suite proves nothing here: the suite read these working-tree files, but the\n` +
    `  COMMITTED tree (what you push, what CI builds, what every other clone gets) does not have them.\n` +
    `  This is exactly how a broken web build shipped in 2.55.0–2.57.0.\n`,
);
for (const r of dirtySource) console.error(`    ~ ${r.path}  (+${r.add}/-${r.del})`);
console.error(`\n  Commit them (or stash them) and re-run the gate. Verify what you COMMITTED.`);
process.exit(1);
