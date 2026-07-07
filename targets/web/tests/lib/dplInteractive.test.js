/**
 * @file Unit tests for gui/src/lib/dpl/dplInteractiveMessages.js — the localized labels the DPL
 * editor's interactive layer (hover dials + `+` line-action menu) consumes.
 */
import { describe, it, expect } from "vitest";
import { createIntl, createIntlCache } from "react-intl";
import { m, buildInteractiveLabels } from "../../frontend/lib/dpl/dplInteractiveMessages.js";

const intl = createIntl({ locale: "en", defaultLocale: "en" }, createIntlCache());

describe("buildInteractiveLabels", () => {
  const labels = buildInteractiveLabels(intl);

  it("returns a non-empty string for every message key it exposes", () => {
    // Keys the extensions actually read off the flat object.
    const used = [
      "intensity",
      "focus",
      "frontMatter",
      "insertFrontMatter",
      "promote",
      "replaceWith",
      "insertAbove",
      "insertBelow",
      "newSection",
      "promBullet",
      "promMaybe",
      "promPct",
      "promOtherwise",
      "promWeight",
      "promCond",
      "tplText",
      "tplBullet",
      "tplOneOf",
      "tplNOf",
      "tplRangeOf",
      "tplOneOfNothing",
      "tplRepeat",
      "tplRepeatRange",
      "tplGoto",
      "tplGoback",
      "tplInsert",
      "tplCall",
      "tplInsertJs",
      "tplComment",
      "fmDesc",
      "fmSuggestions",
      "fmStacking",
      "fmScript",
      "secStart",
      "secAutoBegin",
      "secAutoEnd",
      "secCustom",
    ];
    for (const key of used) {
      expect(typeof labels[key], key).toBe("string");
      expect(labels[key].length, key).toBeGreaterThan(0);
    }
  });

  it("maps the dial captions to their message defaults", () => {
    expect(labels.intensity).toBe("intensity");
    expect(labels.focus).toBe("focus");
  });

  it("covers every defined message (no orphan strings)", () => {
    // Every id in `m` should have been formatted into the labels object.
    const values = new Set(Object.values(labels));
    for (const key of Object.keys(m)) {
      const formatted = intl.formatMessage(m[key]);
      expect(values.has(formatted), key).toBe(true);
    }
  });
});
