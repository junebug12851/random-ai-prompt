/**
 * @file Vitest setup for the SPA suite: Testing Library DOM matchers + auto-cleanup,
 * a clean localStorage between tests (the settings/custom stores persist there), and
 * the shared MSW server for network-touching tests.
 *
 * MSW runs with `onUnhandledRequest: "bypass"` so tests that stub `fetch` directly
 * (or don't touch the network) are unaffected; tests opt in with `server.use(...)`.
 */
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
