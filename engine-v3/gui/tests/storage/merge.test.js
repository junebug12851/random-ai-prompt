/**
 * @file Unit tests for the config-layer merge core (gui/storage/merge.js): deepMerge
 * semantics (recursive objects, array replace/concat, null-clears, undefined-skips,
 * input immutability), diff (sparse patch incl. dropped-key clears), and equal.
 */
import { describe, it, expect } from "vitest";
import { deepMerge, diff, equal, isPlainObject } from "../../storage/merge.js";

describe("isPlainObject", () => {
  it("accepts plain objects only", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(5)).toBe(false);
  });
});

describe("deepMerge", () => {
  it("merges nested objects, override winning per leaf", () => {
    const base = { a: 1, nested: { x: 1, y: 2 }, keep: "yes" };
    const over = { a: 2, nested: { y: 9, z: 3 } };
    expect(deepMerge(base, over)).toEqual({
      a: 2,
      nested: { x: 1, y: 9, z: 3 },
      keep: "yes",
    });
  });

  it("replaces arrays wholesale by default", () => {
    expect(deepMerge({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] });
  });

  it("can concat arrays when asked", () => {
    expect(deepMerge({ list: [1, 2] }, { list: [3] }, { arrays: "concat" })).toEqual({
      list: [1, 2, 3],
    });
  });

  it("treats explicit null as a clear and undefined as 'keep the base'", () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: null, b: undefined })).toEqual({ a: null, b: 2 });
  });

  it("lets the override win on a type mismatch", () => {
    expect(deepMerge({ a: { x: 1 } }, { a: 5 })).toEqual({ a: 5 });
    expect(deepMerge({ a: [1] }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it("returns the base clone when the override is undefined", () => {
    const base = { a: { b: 1 } };
    const out = deepMerge(base, undefined);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
    expect(out.a).not.toBe(base.a);
  });

  it("never mutates its inputs", () => {
    const base = { nested: { x: 1 } };
    const over = { nested: { y: 2 } };
    const baseCopy = JSON.parse(JSON.stringify(base));
    const overCopy = JSON.parse(JSON.stringify(over));
    deepMerge(base, over);
    expect(base).toEqual(baseCopy);
    expect(over).toEqual(overCopy);
  });
});

describe("diff", () => {
  it("extracts only the changed keys", () => {
    const base = { a: 1, b: 2, nested: { x: 1, y: 2 } };
    const value = { a: 1, b: 5, nested: { x: 1, y: 9 } };
    expect(diff(base, value)).toEqual({ b: 5, nested: { y: 9 } });
  });

  it("emits a null for a key dropped from the value", () => {
    expect(diff({ a: 1, b: 2 }, { a: 1 })).toEqual({ b: null });
  });

  it("is the inverse of deepMerge (merge(base, diff(base, v)) === v)", () => {
    const base = { a: 1, b: { x: 1, y: 2 }, list: [1, 2] };
    const value = { a: 1, b: { x: 7, y: 2 }, list: [9], extra: true };
    expect(deepMerge(base, diff(base, value))).toEqual(value);
  });

  it("returns an empty patch when nothing differs", () => {
    expect(diff({ a: 1, n: { x: 1 } }, { a: 1, n: { x: 1 } })).toEqual({});
  });
});

describe("equal", () => {
  it("compares structurally, order-independent for object keys", () => {
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(equal([1, 2], [1, 2])).toBe(true);
    expect(equal([1, 2], [2, 1])).toBe(false);
    expect(equal({ a: 1 }, { a: 2 })).toBe(false);
  });
});
