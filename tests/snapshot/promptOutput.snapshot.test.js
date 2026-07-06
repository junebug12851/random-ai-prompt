/**
 * @file Snapshot tests. Randomness is pinned with a seeded PRNG so the generated
 * output is byte-for-byte reproducible; the snapshot then locks the rendered shape.
 * These guard against accidental behavioural drift in the renderer/pipeline.
 */
import { describe, it, expect } from "vitest";
import compileDpl from "../../engine/core/dpl/dpl.js";
import { createEngine } from "../../engine/core/engine.js";
import { makeFakeLoader } from "../helpers/fakeLoader.js";
import { withSeed } from "../helpers/seededRandom.js";

const DPL = `---
description: A small seeded scene generator
---
Start
===
[10] a quiet
one of:
  - 50% forest
  - meadow
  - 80% riverbank
maybe: at golden hour
repeat 1 to 2 times: with mist
`;

describe("DPL render snapshot (seeded)", () => {
  it("is reproducible for a fixed seed", () => {
    // No intensity argument → the default (50%), so gates/counts render at half-scale.
    const mod = compileDpl(DPL, { resolveJs: () => "" });
    const out = withSeed(12345, () => mod.default({}, {}, {}));
    expect(out).toMatchSnapshot();
  });

  it("differs across seeds (sanity: randomness is actually applied)", () => {
    const mod = compileDpl(DPL, { resolveJs: () => "" });
    const a = withSeed(1, () => mod.default({}, {}, {}));
    const b = withSeed(99, () => mod.default({}, {}, {}));
    // Not a hard guarantee, but with this DPL the two seeds diverge.
    expect(a).not.toBe(b);
  });
});

describe("engine pipeline snapshot (seeded)", () => {
  it("locks the composite pipeline output", () => {
    // Single-entry lists keep the list stage deterministic (lodash's RNG can't be
    // stubbed); the DPL "one of" is driven by Math.random, which withSeed controls.
    const engine = createEngine(
      makeFakeLoader({
        lists: { adjective: ["misty"], scene: ["forest"] },
        dpl: { mood: "one of:\n  - serene\n  - dramatic\n  - moody" },
      }),
    );
    const settings = {
      artistFilename: "artist",
      keywordEmphasis: false,
      emphasisChance: 0,
      mode: "StableDiffusion",
      includeArtist: true,
      includeAdult: false,
      listEntriesUsedOnce: true,
      autoAddFx: false,
      autoAddArtists: false,
      promptModules: ["dynamic-prompt", "list", "cleanup"],
    };
    const out = withSeed(2026, () =>
      engine.expand("{adjective} {scene}, {#mood}", settings, {}, {}),
    );
    expect(out).toMatchSnapshot();
  });
});
