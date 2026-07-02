/**
 * @file Unit tests for the pure Home helpers: the image-sidecar snapshot trimmer
 * (lib/home/snapshot.js) and the building-block category split (lib/home/blockCategories.js).
 */
import { describe, it, expect } from "vitest";
import { cleanSnapshot } from "../../src/lib/home/snapshot.js";
import { foldersOf, splitCats } from "../../src/lib/home/blockCategories.js";

describe("cleanSnapshot", () => {
  it("keeps scalar provider knobs and drops orchestration keys, empties, and nested values", () => {
    const out = cleanSnapshot({
      steps: 20,
      cfg: 7,
      provider: "openai", // app-orchestration key -> dropped
      prompt: "hi", // dropped
      promptCount: 3, // dropped
      providerParams: { x: 1 }, // dropped (orchestration)
      empty: "", // dropped
      missing: null, // dropped
      nested: { a: 1 }, // dropped (object)
      fn: () => {}, // dropped (function)
    });
    expect(out).toEqual({ steps: 20, cfg: 7 });
  });

  it("returns an empty object when nothing qualifies", () => {
    expect(cleanSnapshot({ prompt: "x", provider: "y", empty: "" })).toEqual({});
  });
});

describe("splitCats / foldersOf", () => {
  const items = [
    { category: true, label: "scene", token: "{#scene}", description: "scenes" },
    { label: "cave", token: "{#cave}" },
    { label: "castle", token: "{#castle}" },
    { category: true, label: "any" },
    { label: "wildcard", token: "{#any}" },
  ];

  it("splitCats groups chips under their preceding category pill", () => {
    const cats = splitCats(items);
    expect(cats.map((c) => c.label)).toEqual(["scene", "any"]);
    expect(cats[0]).toMatchObject({ token: "{#scene}", description: "scenes" });
    expect(cats[0].items.map((i) => i.label)).toEqual(["cave", "castle"]);
    expect(cats[1].items.map((i) => i.label)).toEqual(["wildcard"]);
  });

  it("foldersOf drops the merged wildcard/special pseudo-folders", () => {
    const folders = foldersOf({ title: "Blocks", items });
    expect(folders.map((c) => c.label)).toEqual(["scene"]); // "any" dropped
  });

  it("foldersOf folds single-list folders into All for the Lists group", () => {
    const listItems = [
      { category: true, label: "look" },
      { label: "color" },
      { label: "clothes" },
      { category: true, label: "solo" },
      { label: "only-one" },
    ];
    const folders = foldersOf({ title: "Lists", items: listItems });
    // "look" has 2 lists (kept); "solo" has 1 (folded away, no forceList)
    expect(folders.map((c) => c.label)).toEqual(["look"]);
  });
});
