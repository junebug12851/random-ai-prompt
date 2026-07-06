/**
 * @file Unit tests for src/core/stages/block.js (`{#name}` stage) over an
 * in-memory loader: dial parsing, groups, {#any}, dedup/stacking, auto-append,
 * NSFW gating, the danbooru replacer, and the re-expansion cap.
 */
import { describe, it, expect } from "vitest";
import { makeBlockStage } from "../../engine/core/stages/block.js";

function loader({ modules = {}, groupDirs = [], groups = {}, meta = {} } = {}) {
  return {
    blockNames: () => Object.keys(modules),
    loadBlock: (k) => modules[k] ?? null,
    blockGroupDirsAll: () => groupDirs,
    blockGroupDirs: () => groupDirs,
    readBlockGroup: (n) => groups[n] ?? null,
    readBlockMeta: (n) => meta[n] ?? null,
  };
}

const S = (over = {}) => ({
  includeAdult: false,
  autoAddFx: false,
  autoAddArtists: false,
  keywordsFilename: "keyword",
  ...over,
});

const run = (stage, prompt, settings = S()) => stage(prompt, settings, {}, {});

describe("block — resolution", () => {
  it("runs a generator for {#name}", () => {
    const stage = makeBlockStage(loader({ modules: { greet: { default: () => "hi" } } }));
    expect(run(stage, "{#greet}")).toBe("hi");
  });

  it("resolves a {#category/name} path", () => {
    const stage = makeBlockStage(loader({ modules: { "a/b": { default: () => "ab" } } }));
    expect(run(stage, "{#a/b}")).toBe("ab");
  });

  it("returns '' for an unknown generator", () => {
    const stage = makeBlockStage(loader({ modules: {} }));
    expect(run(stage, "{#missing}")).toBe("");
  });
});

describe("block — dials (intensity/focus)", () => {
  const stage = makeBlockStage(
    loader({ modules: { probe: { default: (_s, _i, _u, i, f) => `${i}/${f}` } } }),
  );
  it("parses i/f percents, defaulting to 50", () => {
    expect(run(stage, "{#probe i25% f80%}")).toBe("25/80");
    expect(run(stage, "{#probe}")).toBe("50/50");
  });
  it("clamps 0→1 and >100→100", () => {
    expect(run(stage, "{#probe i0%}")).toBe("1/50");
    expect(run(stage, "{#probe i150%}")).toBe("100/50");
  });
});

describe("block — dedup / stacking", () => {
  it("renders a singular generator once across nested imports", () => {
    const stage = makeBlockStage(
      loader({
        modules: {
          weather: { default: () => "rain" },
          scene: { default: () => "field, {#weather}, {#weather}" },
        },
      }),
    );
    const out = run(stage, "{#scene}");
    expect(out.match(/rain/g)).toHaveLength(1);
  });

  it("honors user-typed top-level duplicates", () => {
    const stage = makeBlockStage(
      loader({ modules: { weather: { default: () => "rain" } } }),
    );
    expect(run(stage, "{#weather}, {#weather}")).toBe("rain, rain");
  });

  it("exempts a stacking generator from dedup", () => {
    const stage = makeBlockStage(
      loader({
        modules: {
          tint: { default: () => "blue", stacking: true },
          scene: { default: () => "wall, {#tint}, {#tint}" },
        },
      }),
    );
    expect(run(stage, "{#scene}").match(/blue/g)).toHaveLength(2);
  });
});

describe("block — groups and {#any}", () => {
  it("picks one member from an implied folder group", () => {
    const stage = makeBlockStage(
      loader({
        modules: { "scene/a": { default: () => "A" }, "scene/b": { default: () => "B" } },
        groupDirs: ["scene"],
      }),
    );
    expect(["A", "B"]).toContain(run(stage, "{#scene}"));
  });

  it("picks one member from an explicit .group file", () => {
    const stage = makeBlockStage(
      loader({
        modules: { one: { default: () => "1" }, two: { default: () => "2" } },
        groups: { mix: ["one", "two"] },
      }),
    );
    expect(["1", "2"]).toContain(run(stage, "{#mix}"));
  });

  it("{#any} picks one generator from the whole catalog", () => {
    const stage = makeBlockStage(loader({ modules: { only: { default: () => "solo" } } }));
    expect(run(stage, "{#any}")).toBe("solo");
  });
});

describe("block — NSFW gating", () => {
  const stage = makeBlockStage(
    loader({ modules: { "nude-nsfw": { default: () => "x" } } }),
  );
  it("is empty when adult is off", () => {
    expect(run(stage, "{#nude-nsfw}", S({ includeAdult: false }))).toBe("");
  });
  it("renders when adult is on", () => {
    expect(run(stage, "{#nude-nsfw}", S({ includeAdult: true }))).toBe("x");
  });
});

describe("block — auto-append", () => {
  it("appends {#fx} once when autoAddFx is on, resolving nested tokens", () => {
    const stage = makeBlockStage(
      loader({
        modules: { fx: { default: () => "boom {#spark}" }, spark: { default: () => "zap" } },
      }),
    );
    const out = run(stage, "base", S({ autoAddFx: true }));
    expect(out).toContain("boom");
    expect(out).toContain("zap");
    expect(out).not.toContain("{#");
  });
});

describe("block — danbooru replacer", () => {
  it("replaces ', Person' with {d/person} only for a d/ keyword file", () => {
    const stage = makeBlockStage(
      loader({ modules: { g: { default: () => "a, Person" } } }),
    );
    // The replacer regex `/, ?Person/` consumes the comma + space, so "a, Person" → "a{d/person}".
    expect(run(stage, "{#g}", S({ keywordsFilename: "d/general" }))).toBe("a{d/person}");
    expect(run(stage, "{#g}", S({ keywordsFilename: "keyword" }))).toBe("a, Person");
  });
});

describe("block — re-expansion cap", () => {
  it("does not loop forever on a self-importing generator and leaves nothing dangling", () => {
    const stage = makeBlockStage(
      loader({ modules: { loop: { default: () => "{#loop}" } } }),
    );
    const out = run(stage, "{#loop}");
    expect(out).not.toContain("{#loop}"); // dedup stops the recursion within the cap
  });
});
