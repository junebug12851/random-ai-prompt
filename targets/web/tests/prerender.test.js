// @vitest-environment node
/**
 * @file SSR-safety + prerender guard.
 *
 * The ONLINE build prerenders the app's first paint to static HTML at build time (see
 * `gui/scripts/build.mjs` + `gui/src/entry-server.jsx`) and the browser hydrates it. That only stays
 * correct if the app's INITIAL render never touches a browser-only API (window/document/matchMedia/…):
 * such an access would crash the Node prerender and, subtly worse, desync the server HTML from the
 * client's first render and cause a hydration mismatch (a flash).
 *
 * This test renders through the real SSR entry in a **pure Node environment** (no jsdom, so there is
 * no `window`/`document`), so any unguarded browser API in the first-render path fails here — in CI —
 * instead of in a deploy. It also asserts the building-block palette (the Largest Contentful Paint) is
 * present, so the prerender keeps delivering its performance win. The storage cache is mocked to its
 * empty/default state, mirroring the online build (which renders the default-settings shell and lets
 * saved settings settle in after hydration).
 */
import { describe, it, expect, vi } from "vitest";

// Stub the storage cache: hydrated + empty, so the stores return their defaults and App renders its
// shell synchronously (no async backend, no localStorage needed in Node).
vi.mock("../storage/cache.js", () => ({
  isHydrated: () => true,
  hydrate: () => Promise.resolve(),
  rehydrate: () => Promise.resolve(),
  getCached: () => null,
  setCached: () => Promise.resolve(),
  removeCached: () => Promise.resolve(),
  msSinceLastWrite: () => Number.MAX_SAFE_INTEGER,
  cachedKeys: () => [],
  resetCache: () => {},
}));

const { render } = await import("../frontend/entry-server.jsx");

describe("online prerender / SSR-safety", () => {
  it("renders the shell + palette to HTML in pure Node with no browser APIs at render time", () => {
    const html = render();
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain("Random AI Prompt"); // top-bar wordmark
    expect(html).toMatch(/class="[^"]*chip[^"]*"/); // palette chips
    expect(html).toContain("cat-hint-text"); // the LCP element (the palette hint)
  });
});
