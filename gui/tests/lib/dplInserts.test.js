/**
 * @file Unit tests for gui/src/lib/dpl/dplInserts.js — the localized DPL insert catalog.
 */
import { describe, it, expect } from "vitest";
import { createIntl, createIntlCache } from "react-intl";
import { getDplInserts } from "../../src/lib/dpl/dplInserts.js";

const intl = createIntl({ locale: "en", defaultLocale: "en" }, createIntlCache());

describe("getDplInserts", () => {
  const cats = getDplInserts(intl);

  it("returns the expected category set", () => {
    expect(cats.map((c) => c.key)).toEqual([
      "structure",
      "chance",
      "choose",
      "repeat",
      "flow",
      "emphasis",
      "code",
    ]);
  });

  it("localizes every category label and hint", () => {
    for (const c of cats) {
      expect(c.label).toBeTruthy();
      expect(c.hint).toBeTruthy();
      expect(c.items.length).toBeGreaterThan(0);
    }
  });

  it("every item carries a syntax string and a CodeMirror template", () => {
    for (const c of cats) {
      for (const item of c.items) {
        expect(item.id, item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.syntax).toBeTruthy();
        expect(item.template).toBeTruthy();
      }
    }
  });

  it("emphasis wrap items are flagged wrap:true with a ${sel} placeholder", () => {
    const emphasis = cats.find((c) => c.key === "emphasis");
    const wrapItems = emphasis.items.filter((i) => i.wrap);
    expect(wrapItems.length).toBeGreaterThan(0);
    for (const i of wrapItems) expect(i.template).toContain("${sel}");
  });

  it("renders the {#name} token literally in the call item's description (not ICU-parsed)", () => {
    const flow = cats.find((c) => c.key === "flow");
    const call = flow.items.find((i) => i.id === "call");
    expect(call.desc).toContain("{#name}");
  });
});
