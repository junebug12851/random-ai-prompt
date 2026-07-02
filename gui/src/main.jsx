/**
 * The SPA entry point — mounts `<App />` into `#root`.
 *
 * Two mount paths, chosen by whether `#root` already has markup:
 *  - **Hydrate** (online build): the online build prerenders the shell + palette to static HTML at
 *    build time (see `entry-server.jsx` / `prerender/`), so `#root` arrives populated. `hydrateRoot`
 *    reuses that DOM — the Largest Contentful Paint is the prerendered HTML, painted before this JS
 *    runs, and React attaches to it with no clear-and-re-render flash.
 *  - **Fresh mount** (local build / dev): `#root` is empty, so `createRoot` renders from scratch,
 *    exactly as before.
 * @module gui/main
 */
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";

const rootEl = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
