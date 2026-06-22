/**
 * @file Unit tests for src/helpers/keywordRepeater.js — emits N {keyword}/{artist}
 * tokens. Named exports (consumed by destructuring) — verified here too.
 */
import { describe, it, expect } from "vitest";
import { keywordRepeater, artistRepeater } from "../../src/helpers/keywordRepeater.js";
import { keywordAlias } from "../../src/helpers/aliases.js";

// NOTE: these helpers draw from lodash's `_.random`, which captures `Math.random`
// at import time — so a test cannot stub the RNG. We assert invariants (token shape
// and count bounds) over the real distribution instead.

const tokenCount = (s) => (s === "" ? 0 : s.split(", ").length);

describe("keywordRepeater", () => {
  it("emits exactly count tokens when min == max", () => {
    const out = keywordRepeater("keyword", false, { keywordCount: 3, keywordMaxCount: 3 });
    expect(out).toBe("{keyword}, {keyword}, {keyword}");
  });

  it("wraps the alias target when alias is true", () => {
    const out = keywordRepeater("keyword", true, { keywordCount: 2, keywordMaxCount: 2 });
    // The alias for "keyword" is itself ("keyword"); the alias indirection is
    // resolved downstream in the list store, not here.
    expect(out).toBe(`{${keywordAlias}}, {${keywordAlias}}`);
  });

  it("stays within the random range bounds", () => {
    for (let i = 0; i < 50; i++) {
      const n = tokenCount(keywordRepeater("keyword", false, { keywordCount: 4, keywordMaxCount: 9 }));
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it("emits nothing for a zero count", () => {
    expect(keywordRepeater("keyword", false, { keywordCount: 0, keywordMaxCount: 0 })).toBe("");
  });
});

describe("artistRepeater", () => {
  it("returns an empty string when artists are disabled", () => {
    expect(artistRepeater("artist", false, { includeArtist: false })).toBe("");
  });

  it("emits either nothing or exactly minArtist..maxArtist tokens when enabled", () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const out = artistRepeater("artist", false, { includeArtist: true, minArtist: 2, maxArtist: 2 });
      const n = tokenCount(out);
      seen.add(n);
      // gated by a 50% coin flip, then minArtist..maxArtist (here fixed at 2)
      expect([0, 2]).toContain(n);
      if (n > 0) expect(out).toBe("{artist}, {artist}");
    }
    // Over 100 tries both outcomes (skip and emit) should appear.
    expect(seen.has(0)).toBe(true);
    expect(seen.has(2)).toBe(true);
  });
});
