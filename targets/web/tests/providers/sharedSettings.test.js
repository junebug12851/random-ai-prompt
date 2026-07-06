/**
 * @file Tests for the shared provider-settings system (gui/providers/_shared/settings/): the
 * auto-discovered injector and the first shared setting, per-provider **batch chunk size**
 * (concurrency). Guards the DRY contract — one declaration applied to every generating provider with
 * metadata-derived defaults, non-destructive to a provider's own fields, and skipped for copy-only
 * tiers.
 */
import { describe, it, expect } from "vitest";
import { applySharedSettings, SHARED_SETTINGS } from "../../shared/_shared/settings/index.js";
import {
  defaultConcurrencyFor,
  effectiveConcurrency,
  clampConcurrency,
  CONCURRENCY_KEY,
  CONCURRENCY_MAX,
} from "../../shared/_shared/settings/concurrency.js";

const local = { id: "comfyui", tier: "api", local: true, transport: "local-direct" };
const hosted = { id: "openai", tier: "api", local: false, transport: "browser-direct" };
const poll = { id: "replicate", tier: "api", local: false, transport: "submit-poll" };
const plain = { id: "plain", tier: "plain", local: false, transport: "none" };
const declared = { id: "x", tier: "api", local: false, transport: "browser-direct", concurrencyDefault: 12 };

describe("concurrency defaults by provider metadata", () => {
  it("is generous for local engines, gentle for hosted APIs", () => {
    expect(defaultConcurrencyFor(local)).toBe(6);
    expect(defaultConcurrencyFor(hosted)).toBe(3);
    expect(defaultConcurrencyFor(poll)).toBe(4);
    expect(defaultConcurrencyFor(plain)).toBe(1);
  });

  it("honours an explicit per-provider concurrencyDefault", () => {
    expect(defaultConcurrencyFor(declared)).toBe(12);
  });

  it("effectiveConcurrency uses the saved param when set, else the default, always clamped", () => {
    expect(effectiveConcurrency(hosted, {})).toBe(3); // falls back to default
    expect(effectiveConcurrency(hosted, { concurrency: 10 })).toBe(10);
    expect(effectiveConcurrency(hosted, { concurrency: 0 })).toBe(1); // clamped up
    expect(effectiveConcurrency(hosted, { concurrency: 9999 })).toBe(CONCURRENCY_MAX); // clamped down
    expect(effectiveConcurrency(hosted, { concurrency: "" })).toBe(3); // blank → default
  });

  it("clampConcurrency guards the range", () => {
    expect(clampConcurrency(-5)).toBe(1);
    expect(clampConcurrency(3.9)).toBe(3);
    expect(clampConcurrency(Number.NaN)).toBe(1);
  });
});

describe("applySharedSettings injector", () => {
  it("registers at least the concurrency shared setting", () => {
    expect(SHARED_SETTINGS.some((s) => s.key === CONCURRENCY_KEY)).toBe(true);
  });

  it("folds the chunk-size field + default into a generating provider's schema", () => {
    const schema = { defaults: { model: "x" }, fields: [{ key: "model", type: "select" }] };
    const out = applySharedSettings(schema, hosted);
    expect(out.defaults.concurrency).toBe(3);
    expect(out.fields.map((f) => f.key)).toContain(CONCURRENCY_KEY);
    expect(out.fields.find((f) => f.key === CONCURRENCY_KEY)).toMatchObject({ type: "number" });
    // Doesn't disturb the provider's own field/default.
    expect(out.defaults.model).toBe("x");
  });

  it("is a no-op for a copy-only provider (no shared setting applies)", () => {
    const out = applySharedSettings({ defaults: {}, fields: [] }, plain);
    expect(out.fields.some((f) => f.key === CONCURRENCY_KEY)).toBe(false);
    expect(out.defaults.concurrency).toBeUndefined();
  });

  it("leaves a provider that declares its own concurrency field untouched", () => {
    const schema = { defaults: { concurrency: 2 }, fields: [{ key: "concurrency", type: "number" }] };
    const out = applySharedSettings(schema, hosted);
    expect(out.defaults.concurrency).toBe(2); // provider's own wins
    expect(out.fields.filter((f) => f.key === CONCURRENCY_KEY)).toHaveLength(1); // not duplicated
  });

  it("handles a null schema (a provider with no settings.js at all)", () => {
    const out = applySharedSettings(null, hosted);
    expect(out.defaults.concurrency).toBe(3);
    expect(out.fields.some((f) => f.key === CONCURRENCY_KEY)).toBe(true);
  });
});
