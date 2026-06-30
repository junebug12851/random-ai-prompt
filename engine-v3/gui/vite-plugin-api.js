/**
 * Vite dev-server middleware — mounts the shared local `/api/*` handler so `npm run web` gets working
 * hosted generation and local-file storage with nothing extra to start. The handler itself lives in
 * `server/apiHandler.js` and is shared verbatim with the standalone release server
 * (`server/serve.js`), so the dev and release backends can never drift. See that module for the
 * route list.
 * @module gui/vite-plugin-api
 */
import { createApiHandler, runStartupMigrations } from "./server/apiHandler.js";

/**
 * The Vite plugin exposing `/api/*` during local dev.
 * @returns {import("vite").Plugin}
 */
export function apiPlugin() {
  return {
    name: "rap-api-middleware",
    configureServer(server) {
      runStartupMigrations();
      server.middlewares.use(createApiHandler());
    },
  };
}
