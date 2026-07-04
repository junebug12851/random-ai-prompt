/**
 * @file Fixture generators + on-disk helpers for the large-scale performance suite. These build the
 * synthetic payloads the perf specs push through the app at the officially supported maximum load —
 * a 100k-image gallery feed, a 100k-line list file, 1000 prompts — plus the tiny image bytes routed
 * in place of real thumbnails so the specs never touch the network or real output folder.
 *
 * The on-disk helpers write REAL files under `data/lists/` (the manage backend only reads inside the
 * data roots), used by the Manage + hot-reload specs to exercise the true file-read and `fs.watch`
 * paths. Every file they create is named `perf-harness-*` (git-ignored) and removed on teardown.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The officially supported maximum simultaneous load the app is designed to stay smooth under. */
export const MAX_LOAD = {
  galleryImages: 100_000,
  prompts: 1_000,
  imagesPerPrompt: 10, // 1000 prompts × 10 = 10k image placeholders
  manageLines: 100_000,
};

// A 1x1 transparent PNG — returned for every /api/output/* request so off-screen (and on-screen)
// thumbnails cost effectively nothing; the perf we care about is DOM/layout/scroll, not decode.
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Build a synthetic gallery feed of `n` items in the exact shape `GET /api/feed` returns (see
 * lib/gallery.js). Kept lean — a small sidecar per item — so serializing 100k stays quick.
 * @param {number} n How many feed items.
 * @returns {{items: object[]}} The feed payload.
 */
export function galleryFeed(n) {
  const items = new Array(n);
  for (let i = 0; i < n; i++) {
    items[i] = {
      path: `/api/output/perf-${i}.png`,
      file: `perf-${i}.png`,
      name: `perf-${i}`,
      mtime: 1_700_000_000_000 - i,
      meta: {
        prompt: { dpl: null, roll: null, ai: null, final: `perf prompt number ${i}, a test image` },
        provider: "sd",
        providerLabel: "Perf SD",
      },
    };
  }
  return { items };
}

/**
 * A list-file body of `n` lines (`perf entry <i>`), for the Manage list editor + hot-reload specs.
 * @param {number} n How many lines.
 * @param {string} [tag] A label folded into each line (so a "modified" file is visibly different).
 * @returns {string} The file text (trailing newline).
 */
export function bigListText(n, tag = "entry") {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = `perf ${tag} ${i}`;
  return out.join("\n") + "\n";
}

const LISTS_DIR = fileURLToPath(new URL("../../data/lists/", import.meta.url));

/**
 * Resolve a `perf-harness-*` file path inside `data/lists/` (guards the naming so teardown can't
 * touch anything real).
 * @param {string} name The base file name (must start with `perf-harness-`).
 * @returns {string} The absolute path.
 */
export function perfListPath(name) {
  if (!/^perf-harness-[\w.-]+$/.test(name)) throw new Error(`unsafe perf fixture name: ${name}`);
  return path.join(LISTS_DIR, name);
}

/**
 * Write a real list file under `data/lists/` (used to exercise the true 100k-line read + fs.watch).
 * @param {string} name The `perf-harness-*.txt` file name.
 * @param {string} text The contents.
 * @returns {string} The absolute path written.
 */
export function writePerfList(name, text) {
  const abs = perfListPath(name);
  fs.writeFileSync(abs, text);
  return abs;
}

/**
 * Remove a perf list file if present (teardown; best-effort).
 * @param {string} name The `perf-harness-*.txt` file name.
 * @returns {void}
 */
export function removePerfList(name) {
  try {
    fs.rmSync(perfListPath(name), { force: true });
  } catch {
    /* already gone */
  }
}
