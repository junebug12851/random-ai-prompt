/**
 * Server (build-time) entry for the ONLINE build's static prerender.
 *
 * `vite build --ssr` bundles this for Node; `prerender/prerender.mjs` imports the built module, calls
 * {@link render} to turn the app's first paint into an HTML string, and injects it into `#root` in
 * the built `dist/index.html`. The browser then hydrates that markup (see `main.jsx`), so the
 * building-block palette — the Largest Contentful Paint — is painted from HTML before any JS runs.
 *
 * Why this is hydration-safe: `renderToString` does NOT run effects, so effect-mounted imperative
 * widgets (the CodeMirror composer) render as their empty host `<div>` — exactly what the client's
 * first render is — and the app's boot renders the default-settings shell online (see App.jsx), which
 * the client's first render also produces. Server output therefore equals the client's first render.
 *
 * This entry is ONLINE-only: it's invoked solely by the prerender step of the online build. The local
 * build never imports it.
 * @module gui/entry-server
 */
import { renderToString } from "react-dom/server";
import App from "./App.jsx";

/**
 * Render the app's first paint to an HTML string (for injection into `#root`).
 * @returns {string} The server-rendered markup.
 */
export function render() {
  return renderToString(<App />);
}
