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

beforeEach(async () => {
  localStorage.clear();
  // The storage cache is a module singleton that survives between tests (localStorage.clear()
  // doesn't touch it) — reset it so each test starts from an empty, un-hydrated cache. Imported
  // dynamically (not at setup top-level) so it doesn't pre-bind gui/storage/* before a test file's
  // own `vi.mock("../../storage/index.js")` can register (config.test.js relies on that mock).
  const { resetCache } = await import("../storage/cache.js");
  resetCache();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
