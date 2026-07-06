import { describe, it, expect } from "vitest";
import emphasis from "../../engine/core/stages/emphasis.js";

const sd = (s) => emphasis(s, { mode: "StableDiffusion" });
const nai = (s) => emphasis(s, { mode: "NovelAI" });
const mdj = (s) => emphasis(s, { mode: "Midjourney" });
const plain = (s) => emphasis(s, { mode: "Plain" });

describe("emphasis stage — typed ()/[] → dialect", () => {
  it("Stable Diffusion: depth → numeric weight (intensity/50)", () => {
    expect(sd("(cat)")).toBe("(cat:1.2)"); // depth 1 → 60 → 1.2
    expect(sd("((cat))")).toBe("(cat:1.4)"); // depth 2 → 70
    expect(sd("(((cat)))")).toBe("(cat:1.6)"); // depth 3 → 80
  });

  it("Stable Diffusion de-emphasis floors at 1, never 0", () => {
    expect(sd("[[[cat]]]")).toBe("(cat:0.4)"); // depth 3 → 20
    expect(sd("[[[[[cat]]]]]")).toBe("(cat:0.02)"); // depth 5 → floor 1
  });

  it("caps at 5 levels (intensity 100 → weight 2)", () => {
    expect(sd("(((((((cat)))))))")).toBe("(cat:2)"); // depth 7 → capped → 100
  });

  it("NovelAI: native nested braces / brackets by level", () => {
    expect(nai("(((cat)))")).toBe("{{{cat}}}");
    expect(nai("[[cat]]")).toBe("[[cat]]");
  });

  it("Midjourney: ::weight", () => {
    expect(mdj("((cat))")).toBe("cat::1.4");
  });

  it("Plain: a natural-language intensity word, no syntax", () => {
    expect(plain("(((cat)))")).toBe("major cat"); // 80
    expect(plain("[[[cat]]]")).toBe("ultra-tiny cat"); // 20
  });

  it("multi-word phrases keep their text", () => {
    expect(sd("((cute fluffy cat))")).toBe("(cute fluffy cat:1.4)");
  });

  it("passes through what it does not own", () => {
    expect(sd("(cat:1.2)")).toBe("(cat:1.2)"); // explicit weight
    expect(sd("[a|b|c]")).toBe("[a|b|c]"); // NovelAI alternation
    expect(nai("[a|b|c]")).toBe("[a|b|c]");
    expect(sd("[123]")).toBe("[123]"); // bare numeric weight
    expect(sd("plain words, no brackets")).toBe("plain words, no brackets");
  });

  it("renders emphasis embedded in surrounding text", () => {
    expect(sd("a photo of ((a cat)), detailed")).toBe("a photo of (a cat:1.4), detailed");
  });
});
