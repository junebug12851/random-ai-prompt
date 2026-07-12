/**
 * @file The DPL insert catalog — the engine's grammar, and the label layers that must cover it.
 *
 * This test is what replaced `checkDplInserts` (the mobile ⇄ web drift check). The check existed only
 * because the catalog was hand-ported into the phone; now both targets read
 * `engine/dplInsertCatalog.js`, so they *cannot* drift and comparing them would be comparing a file to
 * itself. What CAN still go wrong is real, and is what's asserted here:
 *
 *   1. The grammar itself regressing (a construct silently dropped, a template losing its tab stops).
 *   2. A target's label layer falling behind the grammar — add a construct to the engine, forget the
 *      string, and the phone renders `undefined` while every other test stays green.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DPL_INSERT_CATALOG,
  camelId,
  materializeTemplate,
  buildInsertMenu,
} from "../../engine/dplInsertCatalog.js";
import { CATEGORY_LABELS, ITEM_LABELS } from "../../targets/mobile/lib/dplInserts.js";

const ids = DPL_INSERT_CATALOG.flatMap((c) => c.items.map((i) => i.id));

describe("engine/dplInsertCatalog — the grammar", () => {
  it("carries the seven categories the DPL compiler implements", () => {
    expect(DPL_INSERT_CATALOG.map((c) => c.key)).toEqual([
      "structure",
      "chance",
      "choose",
      "repeat",
      "flow",
      "emphasis",
      "code",
    ]);
  });

  it("gives every construct an id, literal syntax and an editor template", () => {
    for (const c of DPL_INSERT_CATALOG) {
      expect(c.items.length, `category ${c.key} is empty`).toBeGreaterThan(0);
      for (const it of c.items) {
        expect(it.id, `${c.key} item without an id`).toBeTruthy();
        expect(typeof it.syntax, `${it.id}.syntax`).toBe("string");
        expect(typeof it.template, `${it.id}.template`).toBe("string");
      }
    }
  });

  it("has unique ids (the label layers key off them)", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("materializes a template to insertable text (tab stops → defaults, ${sel} → nothing)", () => {
    expect(materializeTemplate("${1:2} of\n  - ${2:option}")).toBe("2 of\n  - option");
    expect(materializeTemplate("((${sel}))")).toBe("(())");
    expect(materializeTemplate("go back")).toBe("go back");
  });

  it("camelId maps an id to its label key", () => {
    expect(camelId("one-of-nothing")).toBe("oneOfNothing");
    expect(camelId("salt")).toBe("salt");
  });
});

describe("label layers cover the grammar", () => {
  it("mobile has an English label + description for every category and construct", () => {
    for (const c of DPL_INSERT_CATALOG) {
      const cat = CATEGORY_LABELS[camelId(c.key)];
      expect(cat, `mobile category label missing: ${c.key}`).toBeTruthy();
      expect(cat.label && cat.hint, `mobile category ${c.key} label/hint`).toBeTruthy();
      for (const it of c.items) {
        const lab = ITEM_LABELS[camelId(it.id)];
        expect(lab, `mobile item label missing: ${it.id}`).toBeTruthy();
        expect(lab.label && lab.desc, `mobile item ${it.id} label/desc`).toBeTruthy();
      }
    }
  });

  it("the web has a react-intl message for every category and construct", () => {
    // Read the source rather than importing it — the message module pulls in react-intl, which is the
    // web target's dependency, not the engine suite's.
    const src = readFileSync(
      new URL("../../targets/web/frontend/lib/dpl/dplInsertsMessages.js", import.meta.url),
      "utf8",
    );
    const keys = new Set([...src.matchAll(/^\s{2}([a-zA-Z]+):\s*\{/gm)].map((m) => m[1]));
    for (const c of DPL_INSERT_CATALOG) {
      expect(keys.has(`${camelId(c.key)}Label`), `web message ${c.key}Label`).toBe(true);
      expect(keys.has(`${camelId(c.key)}Hint`), `web message ${c.key}Hint`).toBe(true);
      for (const it of c.items) {
        expect(keys.has(`${camelId(it.id)}Label`), `web message ${it.id}Label`).toBe(true);
        expect(keys.has(`${camelId(it.id)}Desc`), `web message ${it.id}Desc`).toBe(true);
      }
    }
  });

  it("buildInsertMenu hangs a target's labels on the shared grammar without touching the DPL", () => {
    const menu = buildInsertMenu({
      category: (c) => ({ label: `C:${c.key}`, hint: "" }),
      item: (it) => ({ label: `I:${it.id}`, desc: "" }),
    });
    const bullet = menu[0].items[0];
    expect(menu[0].label).toBe("C:structure");
    expect(bullet.label).toBe("I:bullet");
    expect(bullet.syntax).toBe("- <text>"); // the grammar survives the labelling, verbatim
  });
});
