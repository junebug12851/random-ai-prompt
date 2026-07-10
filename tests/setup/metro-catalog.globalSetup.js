/**
 * @file Vitest globalSetup — prepares the Metro-loader parity fixture ONCE, before any test worker
 * spawns, while the filesystem is quiescent.
 *
 * Why this exists (test-isolation, not vanity): tests/mobile/metroLoader.test.js proves the generated
 * Metro catalog drives the engine identically to the filesystem `nodeLoader`. Doing that comparison
 * inside a parallel worker is inherently racy:
 *   - metroLoader statically imports engine/core/metroCatalogData.js, a gitignored ~1.2MB module built
 *     by scripts/build-metro-catalog.mjs. Building it inside a worker means the full-tree scan runs
 *     while 30+ sibling workers hammer the same engine/data files — on Windows a momentary sharing
 *     violation can drop a real block from the scan.
 *   - manageFs.test.js transiently writes real fixtures (the `zz-manage-test` namespace) into the shared
 *     engine/data/blocks root, so a LIVE nodeLoader read taken mid-run can see a name the built-in
 *     catalog never should.
 * Building the catalog and snapshotting nodeLoader's built-in surface HERE — before workers exist —
 * freezes both sides from a clean state, so the parity check is deterministic on every platform.
 * The snapshots are handed to the worker via Vitest's provide/inject.
 */
import { execFileSync } from "node:child_process";

/** Drop the local/desktop-only `user/` overlay so we compare like-for-like built-in catalogs. */
const noUser = (names) => names.filter((n) => !String(n).startsWith("user/"));

export default async function setup({ provide }) {
  // Build the FULL-tier catalog (idempotent) so metroLoader's static import has the built-in corpus.
  execFileSync("node", ["scripts/build-metro-catalog.mjs", "--tier=full"], { stdio: "pipe" });

  const { nodeLoader } = await import("../../engine/core/nodeLoader.js");
  provide("builtinBlockNames", noUser(nodeLoader.blockNames()));
  provide("builtinListNames", noUser(nodeLoader.listNames()));

  // Freeze nodeLoader's generations for the parity prompts here too, so the byte-identical check
  // compares metro's live output against a clean-state nodeLoader baseline (never a live read that a
  // sibling test could perturb). Seed determinism is the whole premise of the parity, so a captured
  // baseline is equivalent to a live nodeLoader for the same seeds.
  const { createEngine } = await import("../../engine/core/engine.js");
  const baseSettings = (await import("../../engine/settings.js")).default;
  const prompts = [
    "{#random-words}",
    "{#scene}",
    "a {look/color} {nature/flower} in {place/city}",
    baseSettings.prompt,
  ];
  const nEng = createEngine(nodeLoader);
  const nodeGenerations = {};
  for (const prompt of prompts) {
    for (let seed = 1; seed <= 4; seed++) {
      nodeGenerations[`${prompt}::${seed}`] = nEng.generate({
        ...baseSettings,
        prompt,
        seed,
        generateImages: false,
      });
    }
  }
  provide("parityPrompts", prompts);
  provide("nodeGenerations", nodeGenerations);
}
