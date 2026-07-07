/**
 * @file Unit tests for gui/lib/dpl/dplRefine.js — the refine-action catalog + the DPL output cleaner.
 */
import { describe, it, expect } from "vitest";
import { createIntl, createIntlCache } from "react-intl";
import {
  getDplRefineActions,
  cleanDplOutput,
  buildCustomPrompt,
  DPL_REFINE_MODES,
  DPL_CREATE_MODE,
  DPL_CUSTOM_MODE,
} from "../../frontend/lib/dpl/dplRefine.js";

const intl = createIntl({ locale: "en", messages: {} }, createIntlCache());

describe("getDplRefineActions", () => {
  const groups = getDplRefineActions(intl);

  it("builds the five dimension groups plus a polish group", () => {
    expect(groups.map((g) => g.key)).toEqual([
      "detail",
      "complex",
      "focus",
      "intensity",
      "variety",
      "polish",
    ]);
  });

  it("gives each dimension a more/less pair and polish a single action", () => {
    for (const g of groups.slice(0, 5)) {
      expect(g.actions).toHaveLength(2);
      expect(g.actions.map((a) => a.dir)).toEqual(["more", "less"]);
    }
    const polish = groups.find((g) => g.key === "polish");
    expect(polish.actions).toHaveLength(1);
    expect(polish.actions[0].dir).toBe("only");
  });

  it("emits exactly the refine modes the router knows, with labels + hints", () => {
    const modes = groups.flatMap((g) => g.actions.map((a) => a.mode));
    expect(modes.sort()).toEqual([...DPL_REFINE_MODES].sort());
    expect(modes).not.toContain(DPL_CREATE_MODE); // create lives on its own control
    expect(modes).not.toContain(DPL_CUSTOM_MODE); // custom modify lives on its own control
    for (const g of groups) {
      for (const a of g.actions) {
        expect(a.label).toBeTruthy();
        expect(a.hint).toBeTruthy();
        expect(a.id).toBeTruthy();
      }
    }
  });
});

describe("cleanDplOutput", () => {
  it("passes plain DPL through, trimming only the outer blank lines", () => {
    const dpl = "Start\n===\nknight, warrior\n- helmet";
    expect(cleanDplOutput(`\n\n${dpl}\n`)).toBe(dpl);
  });

  it("strips a wrapping markdown code fence (with or without a language tag)", () => {
    const dpl = "Start\n===\na fox";
    expect(cleanDplOutput("```dpl\n" + dpl + "\n```")).toBe(dpl);
    expect(cleanDplOutput("```\n" + dpl + "\n```")).toBe(dpl);
  });

  it("preserves interior indentation and blank lines", () => {
    const dpl = "one of:\n  - a\n  - b\n\n- tail";
    expect(cleanDplOutput("```\n" + dpl + "\n```")).toBe(dpl);
  });

  it("drops a single pair of wrapping quotes on a one-line reply", () => {
    expect(cleanDplOutput('"a lone fox"')).toBe("a lone fox");
    expect(cleanDplOutput("'a lone fox'")).toBe("a lone fox");
  });

  it("normalizes CRLF and returns empty for nothing usable", () => {
    expect(cleanDplOutput("a\r\nb")).toBe("a\nb");
    expect(cleanDplOutput("")).toBe("");
    expect(cleanDplOutput(null)).toBe("");
  });
});

describe("buildCustomPrompt", () => {
  it("packs the instruction and template around the --- TEMPLATE --- delimiter", () => {
    const out = buildCustomPrompt("  make it ornate  ", "Start\n===\nknight");
    expect(out).toBe("INSTRUCTION:\nmake it ornate\n\n--- TEMPLATE ---\nStart\n===\nknight");
  });

  it("tolerates nullish inputs", () => {
    expect(buildCustomPrompt(null, null)).toBe("INSTRUCTION:\n\n\n--- TEMPLATE ---\n");
  });
});
