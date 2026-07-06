/**
 * @file Unit tests for the pure SingleView helpers: the Markdown exporter (lib/single/markdown.js)
 * and the JSON syntax highlighter (lib/single/json.js).
 */
import { describe, it, expect } from "vitest";
import { toMarkdown } from "../../frontend/lib/single/markdown.js";
import { syntaxHighlightJson } from "../../frontend/lib/single/json.js";

describe("toMarkdown", () => {
  it("emits prompt, negative, a details table (present rows only), and the credit line", () => {
    const md = toMarkdown("a fox", "blurry", [
      ["Model", "SDXL"],
      ["Steps", 30],
      ["Empty", ""],
      ["Missing", null],
    ]);
    expect(md).toContain("**Prompt**: a fox");
    expect(md).toContain("**Negative prompt**: blurry");
    expect(md).toContain("| Field | Value |");
    expect(md).toContain("| Model | SDXL |");
    expect(md).toContain("| Steps | 30 |");
    expect(md).not.toContain("Empty");
    expect(md).not.toContain("Missing");
    expect(md).toContain("Random AI Prompt");
  });

  it("escapes pipes in values and omits empty sections", () => {
    const md = toMarkdown("", "", [["Note", "a|b"]]);
    expect(md).not.toContain("**Prompt**");
    expect(md).not.toContain("**Negative prompt**");
    expect(md).toContain("| Note | a\\|b |");
  });
});

describe("syntaxHighlightJson", () => {
  it("wraps keys, strings, numbers, booleans, and null in classed spans", () => {
    const html = syntaxHighlightJson('{"k":"v","n":12,"b":true,"z":null}');
    expect(html).toContain('<span class="json-key">"k":</span>');
    expect(html).toContain('<span class="json-str">"v"</span>');
    expect(html).toContain('<span class="json-num">12</span>');
    expect(html).toContain('<span class="json-bool">true</span>');
    expect(html).toContain('<span class="json-null">null</span>');
  });

  it("HTML-escapes the input before wrapping", () => {
    const html = syntaxHighlightJson('{"x":"<b>&"}');
    expect(html).toContain("&lt;b&gt;&amp;");
    expect(html).not.toContain("<b>");
  });
});
