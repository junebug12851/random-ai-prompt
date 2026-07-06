import { describe, it, expect } from "vitest";
import { validateDpl, dplStatus } from "../frontend/lib/dpl/validateDpl.js";

const errs = (t) => validateDpl(t).filter((d) => d.severity === "error");
const warns = (t) => validateDpl(t).filter((d) => d.severity === "warning");

describe("validateDpl", () => {
  it("clean DPL has no diagnostics", () => {
    expect(validateDpl("a cat, {color} fur, (((bright)))")).toHaveLength(0);
    expect(validateDpl("")).toHaveLength(0);
  });

  it("flags an unclosed { token", () => {
    expect(errs("a {color cat")[0].message).toMatch(/Unclosed '\{'/);
    expect(errs("a color} cat")[0].message).toMatch(/no matching/);
  });

  it("flags a go to with no such section", () => {
    expect(errs("go to Nowhere")[0].message).toMatch(/no section named "Nowhere"/);
  });

  it("accepts a go to that targets a real section", () => {
    const src = "go to Tail\n\nTail\n===\n- a fox";
    expect(errs(src)).toHaveLength(0);
  });

  it("flags mixed tabs and spaces in indentation", () => {
    expect(errs("one of\n \t- a\n \t- b").some((d) => /Mixed tabs and spaces/.test(d.message))).toBe(true);
  });

  it("flags unclosed front matter", () => {
    expect(errs("---\ndescription: hi\nbody").some((d) => /never closed/.test(d.message))).toBe(true);
  });

  it("leaves NovelAI alternation [a|b|c] alone", () => {
    expect(validateDpl("[a|b|c]")).toHaveLength(0);
  });

  it("treats an unbalanced bracket as a warning, not an error", () => {
    expect(errs("a (cat")).toHaveLength(0);
    expect(warns("a (cat").length).toBeGreaterThan(0);
  });

  it("dplStatus summarizes counts", () => {
    expect(dplStatus("a {color} cat").errors).toBe(0);
    expect(dplStatus("a {color cat").errors).toBe(1);
  });
});
