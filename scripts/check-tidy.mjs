/**
 * @file
 * @brief Working-tree tidiness guard. Fails (exit 1) if there are **untracked, non-ignored** files
 * (`git status` porcelain `??` entries). Those are almost always useful files someone wrote — notes,
 * fairyfox reports, docs — that were never committed. Gitignored machine junk (`/_*.log`, `output/`,
 * `node_modules/`, coverage, etc.) does NOT show as `??`, so it never trips this. Run this before
 * finishing a work session so nothing valuable is left behind uncommitted.
 *
 * (Not part of the CI gate — a fresh CI checkout has no untracked files, and untracked WIP mid-session
 * is normal. This is an end-of-work / pre-handoff check. See notes/reference/repo-hygiene.md.)
 *
 * Run: `npm run check:tidy`  (or: `node scripts/check-tidy.mjs`)
 */
import { execSync } from "node:child_process";

let porcelain = "";
try {
  porcelain = execSync("git status --porcelain --untracked-files=all", { encoding: "utf8" });
} catch (e) {
  console.error("check-tidy: could not run git status (is this a git repo?).", e.message);
  process.exit(1);
}

const untracked = porcelain
  .split("\n")
  .filter((l) => l.startsWith("??"))
  .map((l) => l.slice(3).trim())
  .filter(Boolean);

if (untracked.length) {
  console.error(
    `✗ ${untracked.length} untracked (non-ignored) file(s) — commit them or gitignore them:\n`,
  );
  for (const f of untracked) console.error("  " + f);
  console.error(
    "\nNotes, docs, and fairyfox reports must never be left uncommitted. If a file is genuinely\n" +
      "machine-local, add it to .gitignore. See notes/reference/repo-hygiene.md.",
  );
  process.exit(1);
}

console.log("✓ working tree tidy — no untracked, non-ignored files.");
