/**
 * @file
 * Root Vitest config — the Node-side test suite (core engine, shared browser-safe
 * modules, integration, contract/API, snapshot, and bug-regression tests). Runs in the
 * `node` environment; the React SPA has its own jsdom config under `targets/web/`.
 *
 * Scope rule (matches CLAUDE.md): tests target the ACTIVE engine (`engine/core/**`) and the
 * shared pure modules only — never the legacy classic server (`engine/server.js`,
 * `engine/web/frontend/**`, `engine/core/stages/**` except the pure stages the core engine
 * still imports, i.e. cleanup.js / prompt-salt.js).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The mobile target imports the cross-target app layer as `shared/…` (Metro aliases it via
  // `resolver.extraNodeModules`, exactly like `engine`). Mirror that alias here so the Node suite can
  // import mobile modules that reach into the shared provider registry.
  resolve: {
    alias: { shared: path.join(repoRoot, "targets", "shared") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // The SPA suite is run separately (npm run test:web) with its own jsdom config.
    exclude: ["node_modules/**", "targets/web/**", "tests/e2e/**"],
    // Builds the generated Metro catalog + snapshots nodeLoader's built-in surface ONCE, before any
    // worker spawns, so tests/mobile/metroLoader.test.js can't race manageFs's shared-FS fixtures or
    // concurrent-read scan misses. See the file header for the full rationale.
    globalSetup: ["./tests/setup/metro-catalog.globalSetup.js"],
    globals: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/node",
      include: [
        "engine/core/**/*.js",
        "engine/contentSafety.js",
        "engine/gatedLists.js",
        // NOTE: engine/listManifest.js is intentionally NOT measured — it is a pure re-export barrel
        // (no logic of its own). The real code lives in the three focused, browser-safe modules below,
        // which the list tests exercise (through the barrel), so their coverage IS counted. Measuring
        // the barrel just reports its re-export lines as 0% and drags the aggregate down for nothing.
        "engine/listTags.js",
        "engine/nameOrder.js",
        "engine/listResolve.js",
        "engine/blockManifest.js",
        "engine/promptFilesAndSuggestions.js",
        "engine/promptRun.js",
        "engine/nodeEngine.js",
        "engine/presets.js",
        "engine/helpers/*.js",
        "engine/core/stages/cleanup.js",
        "engine/core/stages/prompt-salt.js",
      ],
      // The browser loader + its code-split prompt-corpus module are exercised by the SPA (jsdom)
      // suite via import.meta.glob, so they aren't measurable from the Node environment — exclude them
      // from the Node gate.
      exclude: [
        "engine/core/browserLoader.js",
        "engine/core/browserCatalogData.js",
        // The browser user-overlay catalog is likewise browser-only (import.meta.glob over user/),
        // exercised by the SPA (jsdom) suite, not the Node gate — so don't count it here.
        "engine/core/browserUserCatalog.js",
        // metroCatalogData.js is a GENERATED, gitignored ~1.2MB static-data module (built by
        // scripts/build-metro-catalog.mjs) -- data, not logic, so it is not unit-testable and is
        // excluded exactly like its browser twin browserCatalogData.js above. The metroLoader.js
        // LOGIC that reads it is deliberately NOT excluded: it is exercised for real (every method +
        // a seeded generation) by tests/mobile/metroLoader.test.js, so its coverage is earned here.
        "engine/core/metroCatalogData.js",
      ],
      // `lcov` is added for Codecov (CI uploads coverage/node/lcov.info); text+html are for humans.
      reporter: ["text", "html", "lcov"],
      // CI gate (owner-approved). Set with headroom below the measured numbers
      // (lines ~93 / statements ~90 / functions ~93 / branches ~80) so a real
      // regression fails CI without flaking on minor churn. Tighten as coverage grows.
      thresholds: {
        statements: 88,
        branches: 76,
        functions: 88,
        lines: 90,
      },
    },
  },
});
