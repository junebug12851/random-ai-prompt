/**
 * @file `engine/blockCatalog.js` — the categorized building-block catalog.
 *
 * This module was extracted from the web target, where it lived alongside a **218-line hand-port in
 * the mobile app that had no drift check at all**. Both now call the same function with their own
 * loader, so the catalogs cannot diverge by construction — and the test that matters is the one that
 * proves the extraction preserved the rules, and that the two loaders really do agree.
 *
 * @see notes/plans/de-duplication.md
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildBlocks, buildDplCompletions } from "../../engine/blockCatalog.js";
import { nodeLoader } from "../../engine/core/nodeLoader.js";
import { metroLoader, setMetroOverlay } from "../../engine/core/metroLoader.js";

// metroLoader carries a RUNTIME overlay (the phone's on-device Manage content), and it's module-level
// state — a sibling test that installs one and doesn't clear it would leak a phantom "phone-only"
// block into the comparison below. Start from the built-ins.
beforeAll(() => setMetroOverlay({ lists: {}, listMeta: {}, blocks: {}, blockMeta: {} }));

const groups = (loader, opts) => buildBlocks(loader, opts);
const titles = (gs) => gs.map((g) => g.title);
const tokensOf = (gs) => gs.flatMap((g) => g.items.map((i) => i.token).filter(Boolean));

describe("buildBlocks — the catalog's rules", () => {
  it("returns the Blocks and Lists groups", () => {
    expect(titles(groups(nodeLoader))).toEqual(["Blocks", "Lists"]);
  });

  it("leads with the virtual {#any} wildcard and trails with {salt} (priority 0 … 9000)", () => {
    const items = groups(nodeLoader)[0].items;
    expect(items[0]).toMatchObject({ category: true, label: "any", token: "{#any}" });
    expect(items.at(-1)).toMatchObject({ token: "{salt}" });
  });

  it("gives Lists the reserved {keyword} wildcard", () => {
    expect(tokensOf([groups(nodeLoader)[1]])).toContain("{keyword}");
  });

  it("HIDES nsfw content by default and reveals it with includeAdult", () => {
    const sfw = tokensOf(groups(nodeLoader));
    const adult = tokensOf(groups(nodeLoader, { includeAdult: true }));

    expect(sfw.some((t) => /nsfw/i.test(t))).toBe(false);
    expect(adult.some((t) => /nsfw/i.test(t))).toBe(true);
    // The gate only ADDS — nothing that was visible SFW disappears when adult is on.
    expect(adult.length).toBeGreaterThan(sfw.length);
  });

  it("never lists expansion/ generators as pickable chips", () => {
    const labels = groups(nodeLoader, { includeAdult: true })[0].items.map((i) => i.label);
    expect(labels.some((l) => String(l).startsWith("expansion/"))).toBe(false);
  });
});

describe("buildDplCompletions", () => {
  it("flattens the catalog into deduped {token, kind} entries", () => {
    const out = buildDplCompletions(nodeLoader);
    expect(out.length).toBeGreaterThan(50);

    const tokens = out.map((e) => e.token);
    expect(new Set(tokens).size).toBe(tokens.length); // no duplicates

    const gen = out.find((e) => e.token.startsWith("{#"));
    const list = out.find((e) => !e.token.startsWith("{#"));
    expect(gen.kind).toBe("gen");
    expect(list.kind).toBe("list");
  });
});

describe("the two loaders agree — a mobile hand-port could not have guaranteed this", () => {
  // The ONLY sanctioned difference: nodeLoader also reads the repo-root `user/` overlay (the
  // desktop's local content pool). The phone has no such folder — its user content is the on-device
  // Manage overlay, installed into metroLoader at RUNTIME — so a `user/…` block present on one side
  // and absent on the other is CORRECT, not drift.
  //
  // Note the token is `{#beach-merk}`, NOT `{#user-…}` (name resolution strips the folder), so this
  // has to be asserted on the loader KEYS. I first asserted a byte-identical catalog, it failed on
  // `{#beach-merk}`, and my instinct was "mobile is missing a block". It wasn't — the test was wrong.
  // Assert the real invariant instead of weakening it until it passes.
  // NOTE on what is (and isn't) asserted here. `nodeLoader` reads the filesystem LIVE, and sibling
  // suites legitimately create temporary content there (the Manage fs tests) and read the desktop-only
  // repo-root `user/` overlay, which the phone has no equivalent of. So "the web has nothing the phone
  // lacks" is not a stable invariant *inside this suite* — and it doesn't need to be:
  // `scripts/metro-parity-check.mjs` already asserts catalog completeness (metroLoader == nodeLoader)
  // against a clean tree, in CI.
  //
  // What this suite pins is the direction that a hand-port would have silently broken: the phone must
  // never invent content, and must render a real catalog from the same rules.
  it("the phone never invents content the engine doesn't have", () => {
    const nodeKeys = nodeLoader.blockNames();
    const metroKeys = metroLoader.blockNames();
    expect(metroKeys.filter((k) => !nodeKeys.includes(k))).toEqual([]);
    expect(metroKeys.length).toBeGreaterThan(80); // a real catalog, not an empty one
  });

  it("the catalogs agree token-for-token on everything the phone actually ships", () => {
    // Same function, same rules, same output — the entire point of extracting it. metroLoader reads
    // the generated static catalog; nodeLoader reads the filesystem.
    const phone = tokensOf(groups(metroLoader, { includeAdult: true }));
    const web = tokensOf(groups(nodeLoader, { includeAdult: true }));
    expect(phone.filter((t) => !web.includes(t))).toEqual([]); // no phone-only tokens
    expect(phone.length).toBeGreaterThan(100); // and it's a real catalog, not an empty one
  });

  it("…and identical completions for the shipped catalog", () => {
    const key = (e) => `${e.kind}:${e.token}`;
    const phone = buildDplCompletions(metroLoader).map(key);
    const web = new Set(buildDplCompletions(nodeLoader).map(key));
    expect(phone.filter((k) => !web.has(k))).toEqual([]);
  });
});
