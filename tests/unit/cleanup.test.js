/**
 * @file Unit tests for the cleanup pipeline stage (src/core/stages/cleanup.js).
 * This pure stage is still imported by the ACTIVE core engine (src/core/engine.js),
 * so it is in scope despite living under core/stages/.
 */
import { describe, it, expect } from "vitest";
import cleanup from "../../src/core/stages/cleanup.js";

describe("cleanup stage", () => {
  it("collapses runs of spaces to a single space", () => {
    expect(cleanup("a    b     c")).toBe("a b c");
  });

  it("drops empty comma segments", () => {
    expect(cleanup("a, , b")).toBe("a, b");
    expect(cleanup("a,,b")).toBe("a, b");
  });

  it("removes empty parentheses and the space before a paren", () => {
    // Empty parens collapse to an empty comma segment, which is then dropped.
    expect(cleanup("a, ( ), b")).toBe("a, b");
    expect(cleanup("(masterpiece )")).toBe("(masterpiece)");
  });

  it("normalizes trailing commas and whitespace", () => {
    expect(cleanup("sunset, mountains,  ")).toBe("sunset, mountains");
  });

  it("strips a stray comma immediately after AND", () => {
    expect(cleanup("foo AND, bar")).toBe("foo AND bar");
  });

  it("is idempotent on already-clean prompts", () => {
    const clean = "a, b, c";
    expect(cleanup(clean)).toBe(clean);
  });
});
