/**
 * @file The shared MSW (Mock Service Worker) node server for the SPA suite. Started
 * once in tests/setup.js; individual tests register handlers via `server.use(...)`.
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

export const server = setupServer(...handlers);
