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
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

// Vite's `import.meta.glob` silently SKIPS dotfiles, so the browser loader cannot
// discover the `.force-prefix` / `.enable-group-list` / `.disable-group-list` marker
// files that way. This plugin scans `data/lists` with Node fs (which sees dotfiles)
// and exposes the marked folders as a virtual module the browser loader imports.
function listMarkersPlugin(listsDir) {
  const VID = "virtual:list-markers";
  const RESOLVED = "\0" + VID;
  const MARKERS = [".force-prefix", ".enable-group-list", ".disable-group-list"];
  const scan = (marker) => {
    const out = [];
    const walk = (dir, prefix) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
        else if (e.name === marker) out.push(prefix.replace(/\/$/, ""));
      }
    };
    try {
      walk(listsDir, "");
    } catch {
      /* ignore */
    }
    return out;
  };
  const build = () =>
    `export const forcePrefixDirs = ${JSON.stringify(scan(".force-prefix"))};\n` +
    `export const enableGroupDirs = ${JSON.stringify(scan(".enable-group-list"))};\n` +
    `export const disableGroupDirs = ${JSON.stringify(scan(".disable-group-list"))};\n`;
  return {
    name: "list-markers",
    resolveId(id) {
      if (id === VID) return RESOLVED;
    },
    load(id) {
      if (id === RESOLVED) return build();
    },
    configureServer(server) {
      const reload = (f) => {
        if (MARKERS.includes(path.basename(f))) {
          const m = server.moduleGraph.getModuleById(RESOLVED);
          if (m) server.moduleGraph.invalidateModule(m);
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}

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
  plugins: [react(), listMarkersPlugin(path.join(repoRoot, "data", "lists"))],
  resolve: {
    alias: { lodash: lodashDir },
    dedupe: ["lodash"],
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
});
