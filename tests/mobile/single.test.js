/**
 * @file Unit tests for the mobile Single-view helpers (targets/mobile/lib/single.js) — the pure
 * layer-normalization / keyword / details / lineage / markdown logic behind the phone Single screen.
 * These are the mobile analog of the web gallery/single helper tests, verifying real behavior (not
 * just that a marker string exists).
 */
import { describe, it, expect } from "vitest";
import {
  promptLayers,
  negativeLayers,
  sizeFromSettings,
  promptText,
  pick,
  buildDetails,
  parseKeywords,
  linkChildren,
  searchHaystack,
  toMarkdown,
} from "../../targets/mobile/lib/single.js";

describe("promptLayers / negativeLayers", () => {
  it("reads the enriched layers shape", () => {
    const m = { layers: { dpl: "d", roll: "r", ai: "a", final: "f" } };
    expect(promptLayers(m)).toEqual({ dpl: "d", roll: "r", ai: "a", final: "f" });
  });
  it("falls back to a legacy flat prompt string as the sent layer", () => {
    expect(promptLayers({ prompt: "hi" })).toEqual({
      dpl: null,
      roll: null,
      ai: null,
      final: "hi",
    });
  });
  it("handles missing meta", () => {
    expect(promptLayers(null)).toEqual({ dpl: null, roll: null, ai: null, final: null });
  });
  it("negativeLayers reads enriched + legacy + empty", () => {
    expect(negativeLayers({ negativeLayers: { final: "bad" } }).final).toBe("bad");
    expect(negativeLayers({ negative: "nope" }).final).toBe("nope");
    expect(negativeLayers({}).final).toBeNull();
  });
});

describe("promptText", () => {
  it("prefers final then ai then roll then dpl", () => {
    expect(promptText({ layers: { dpl: "d", roll: "r", ai: "a", final: "f" } })).toBe("f");
    expect(promptText({ layers: { dpl: "d", roll: "r", ai: "a", final: null } })).toBe("a");
    expect(promptText({ layers: { dpl: "d", roll: null, ai: null, final: null } })).toBe("d");
    expect(promptText({})).toBe("");
  });
});

describe("sizeFromSettings", () => {
  it("uses size / imageSize / aspectRatio / WxH in order", () => {
    expect(sizeFromSettings({ size: "1024x1024" })).toBe("1024x1024");
    expect(sizeFromSettings({ imageSize: "square_hd" })).toBe("square_hd");
    expect(sizeFromSettings({ aspectRatio: "16:9" })).toBe("16:9");
    expect(sizeFromSettings({ width: 512, height: 768 })).toBe("512×768");
    expect(sizeFromSettings({})).toBe("");
    expect(sizeFromSettings(null)).toBe("");
  });
});

describe("pick", () => {
  it("returns the first present, non-empty value (0 is kept, empty string skipped)", () => {
    expect(pick({ b: "x" }, "a", "b")).toBe("x");
    expect(pick({ a: "", b: 0 }, "a", "b")).toBe(0);
    expect(pick({}, "a")).toBeUndefined();
  });
});

describe("buildDetails", () => {
  it("builds curated rows and splits the rest, dropping shown/empty/object values", () => {
    const item = {
      name: "img.png",
      providerLabel: "ComfyUI",
      model: "sdxl",
      seed: 42,
      size: "1024x1024",
      createdAt: 1700000000000,
      settings: {
        steps: 30,
        cfg: 6.5,
        sampler: "euler",
        model: "sdxl",
        seed: 42,
        extraKnob: "yes",
        nested: { a: 1 },
        blank: "",
      },
    };
    const { rows, rest } = buildDetails(item);
    const map = Object.fromEntries(rows);
    expect(map.Provider).toBe("ComfyUI");
    expect(map.Model).toBe("sdxl");
    // buildDetails passes raw setting values straight through; the fromEntries map is inferred
    // string-valued, so read the numeric rows as numbers to keep the equality types aligned.
    expect(Number(map.Steps)).toBe(30);
    expect(Number(map.CFG)).toBe(6.5);
    expect(map.Sampler).toBe("euler");
    expect(Number(map.Seed)).toBe(42);
    expect(map.Size).toBe("1024x1024");
    expect(map.File).toBe("img.png");
    const restKeys = rest.map(([k]) => k);
    expect(restKeys).toContain("extraKnob");
    expect(restKeys).not.toContain("model");
    expect(restKeys).not.toContain("seed");
    expect(restKeys).not.toContain("nested");
    expect(restKeys).not.toContain("blank");
  });
  it("skips empty curated rows (only File survives with a bare item)", () => {
    const { rows } = buildDetails({ name: "x.png" });
    expect(rows.map(([k]) => k)).toEqual(["File"]);
  });
});

describe("parseKeywords", () => {
  it("splits, strips DPL/brackets/weights, dedupes, drops tiny/numeric", () => {
    const tags = parseKeywords("(masterpiece:1.2), a, fox, fox, 123, cinematic lighting");
    expect(tags).toContain("masterpiece");
    expect(tags).toContain("fox");
    expect(tags).toContain("cinematic lighting");
    expect(tags.filter((t) => t === "fox")).toHaveLength(1);
    expect(tags).not.toContain("a");
    expect(tags).not.toContain("123");
  });
  it("caps at 80", () => {
    const many = Array.from({ length: 200 }, (_, i) => "kw" + i).join(", ");
    expect(parseKeywords(many)).toHaveLength(80);
  });
  it("empty in -> empty out", () => {
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("linkChildren", () => {
  it("attaches children to their parent by name; orphans stay empty", () => {
    const items = [
      { name: "p.png", uri: "u1" },
      {
        name: "c.png",
        uri: "u2",
        parent: "p.png",
        derivedKind: "variation",
        derivedSource: "final",
      },
      { name: "orphan.png", uri: "u3", parent: "missing.png" },
    ];
    const linked = linkChildren(items);
    const p = linked.find((x) => x.name === "p.png");
    expect(p.children).toHaveLength(1);
    expect(p.children[0]).toMatchObject({
      name: "c.png",
      uri: "u2",
      kind: "variation",
      source: "final",
    });
    expect(linked.find((x) => x.name === "orphan.png").children).toEqual([]);
    expect(linked.find((x) => x.name === "c.png").children).toEqual([]);
  });
});

describe("toMarkdown", () => {
  it("emits prompt, negative, and a details table", () => {
    const md = toMarkdown("a fox", "blurry", [
      ["Provider", "ComfyUI"],
      ["Seed", "42"],
    ]);
    expect(md).toContain("**Prompt**");
    expect(md).toContain("a fox");
    expect(md).toContain("**Negative**");
    expect(md).toContain("blurry");
    expect(md).toContain("| Provider | ComfyUI |");
    expect(md).toContain("| Seed | 42 |");
  });
  it("omits empty sections", () => {
    const md = toMarkdown("only prompt", "", []);
    expect(md).toContain("only prompt");
    expect(md).not.toContain("**Negative**");
    expect(md).not.toContain("| --- |");
  });
});

describe("searchHaystack", () => {
  it("includes every layer + provider + name + keywords, lowercased", () => {
    const h = searchHaystack({
      layers: { final: "Fox", dpl: "{#animal}" },
      provider: "ComfyUI",
      name: "IMG.png",
      keywords: ["Neon"],
    });
    expect(h).toContain("fox");
    expect(h).toContain("comfyui");
    expect(h).toContain("img.png");
    expect(h).toContain("neon");
  });
});
