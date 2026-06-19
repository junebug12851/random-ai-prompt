/**
 * @file
 * Vite config for the React SPA: builds `web-app/src` to `dist/` (deployed to
 * Netlify). Allows the dev server to read the repo-root `src/` engine above the
 * web-app root, and pins `lodash` to the SPA's own copy so the build is self-contained
 * (Vite 8 / Rolldown treats an unresolved import as a hard error).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

// The SPA imports the shared prompt engine from repo-root core/ (which bundles
// the dynamic-prompts/ lists/ expansions/ data via import.meta.glob). Allow the
// dev server to read those files above the web-app root.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Those repo-root src/ files (the core engine, every dynamic prompt, and
// promptFilesAndSuggestions.js) `import _ from "lodash"`. Because they live
// outside web-app/, resolution from them would not find web-app's own lodash —
// and Vite 8 / Rolldown treats an unresolved import as a hard error (Vite 6 /
// Rollup only warned). Pin lodash to the SPA's installed copy so the build is
// self-contained: it works on CI and on Netlify, neither of which installs the
// repo-root node_modules.
const lodashDir = path.dirname(require.resolve("lodash/package.json"));

// Plain Vite + React SPA. Builds to dist/ as static files (deployed to Netlify).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { lodash: lodashDir },
    dedupe: ["lodash"],
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
});
