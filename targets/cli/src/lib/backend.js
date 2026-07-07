/**
 * @file
 * @brief Runs the web target's REAL local backend (`apiHandler.js`) in-process on an ephemeral
 * localhost port, and installs a `fetch` shim so the provider adapters' relative endpoints
 * (`/api/forward`, `/api/generate`, `/api/image`, …) resolve to it. This is how the CLI reaches full
 * GUI parity with ZERO duplicated provider logic: every provider's own `code/generate.js` runs
 * unchanged, calling the same backend the browser calls. Local-direct engines (ComfyUI / Forge /
 * SD.Next) work because the backend proxies them via `/api/forward`; hosted APIs work because the
 * backend runs their server adapter; images are ingested + saved with sidecars via `/api/image`,
 * landing in the same `output/` folder the GUI gallery reads.
 */
import http from "node:http";
import { createApiHandler, runStartupMigrations } from "../../../web/backend/apiHandler.js";

let server = null;
let base = "";
let originalFetch = null;

/**
 * Start the in-process backend (idempotent) and install the relative-URL `fetch` shim.
 * @returns {Promise<string>} The backend base URL (e.g. http://127.0.0.1:53421).
 */
export async function startBackend() {
  if (server) return base;
  runStartupMigrations();
  const handler = createApiHandler();
  server = http.createServer((req, res) => {
    handler(req, res, () => {
      // No API route matched — the CLI only uses /api/*, so anything else is a 404.
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Not found" }));
    });
  });
  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  installFetchShim(base);
  return base;
}

/**
 * Wrap the global `fetch` so a request to a root-relative URL (`/api/...`) is sent to the in-process
 * backend. Absolute URLs (the providers' direct API calls) pass through untouched.
 * @param {string} baseUrl The backend base URL.
 * @returns {void}
 */
function installFetchShim(baseUrl) {
  if (originalFetch) return;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    try {
      if (typeof input === "string" && input.startsWith("/")) {
        return originalFetch(baseUrl + input, init);
      }
      if (input instanceof URL && input.protocol === "") {
        return originalFetch(baseUrl + input.pathname + input.search, init);
      }
      if (
        input &&
        typeof input === "object" &&
        typeof input.url === "string" &&
        input.url.startsWith("/")
      ) {
        return originalFetch(baseUrl + input.url, init);
      }
    } catch {
      // fall through to the original fetch
    }
    return originalFetch(input, init);
  };
}

/**
 * Stop the backend and restore the original `fetch`. Safe to call when not started.
 * @returns {Promise<void>}
 */
export async function stopBackend() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
    base = "";
  }
}

/** @returns {string} The backend base URL (empty until started). */
export const backendBase = () => base;
