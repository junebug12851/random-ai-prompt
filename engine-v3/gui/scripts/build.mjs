/**
 * Build orchestrator for the SPA.
 *
 * Local build (`VITE_ONLINE` unset): just the normal client build — unchanged behaviour.
 *
 * Online build (`VITE_ONLINE=true`, e.g. Netlify): after the client build, additionally
 *   1. run an SSR build of `src/entry-server.jsx` (Node bundle),
 *   2. call its `render()` to turn the app's first paint into an HTML string,
 *   3. inject that markup into `#root` in the built `dist/index.html`,
 *   4. discard the throwaway SSR bundle.
 * The browser then hydrates the prerendered markup (see `main.jsx`), so the building-block palette
 * (the Largest Contentful Paint) is painted from static HTML before any JS runs. See
 * `notes/decisions/architecture.md` and `notes/systems/gui.md`.
 *
 * Kept as an explicit script (rather than a Vite plugin doing a nested build inside `closeBundle`) so
 * the steps are transparent and debuggable. Invoked by `npm run build`; the Netlify command
 * (`npm --prefix engine-v3/gui run build`) is unchanged.
 */
import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const guiRoot = path.resolve(scriptDir, "..");
const ONLINE = process.env.VITE_ONLINE === "true";

const ROOT_PLACEHOLDER = '<div id="root"></div>';
const APP_MARKER = '<div class="app"';

/** Run the normal client build (writes `dist/`). */
async function buildClient() {
  await build({ root: guiRoot });
}

/**
 * Build the SSR entry to a Node bundle, render the app's first paint, and inject it into `#root` of
 * the built `dist/index.html`. Only the app subtree is injected — any leading React resource-hint
 * tags (`renderToString` emits e.g. an image preload) are dropped, because the client re-creates
 * those in `<head>` via React's resource system, so injecting them into `#root` would mismatch.
 */
async function prerenderOnline() {
  const ssrOutDir = "dist-ssr";
  await build({
    root: guiRoot,
    build: { ssr: "src/entry-server.jsx", outDir: ssrOutDir, emptyOutDir: true },
  });

  const serverEntry = pathToFileURL(path.join(guiRoot, ssrOutDir, "entry-server.js")).href;
  const { render } = await import(serverEntry);
  const rendered = render();

  const start = rendered.indexOf(APP_MARKER);
  if (start < 0) {
    throw new Error(`prerender: app root markup (${APP_MARKER}…) not found in the server render`);
  }
  const appHtml = rendered.slice(start);

  const indexPath = path.join(guiRoot, "dist", "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes(ROOT_PLACEHOLDER)) {
    throw new Error(`prerender: '${ROOT_PLACEHOLDER}' placeholder not found in dist/index.html`);
  }
  fs.writeFileSync(
    indexPath,
    html.replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`),
  );

  fs.rmSync(path.join(guiRoot, ssrOutDir), { recursive: true, force: true });
  console.log(`prerender: injected ${appHtml.length} chars of prerendered markup into #root`);
}

await buildClient();
if (ONLINE) await prerenderOnline();
