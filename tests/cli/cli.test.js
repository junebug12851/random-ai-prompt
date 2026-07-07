/**
 * @file
 * @brief Unit tests for the CLI target (targets/cli). Network-free and deterministic: they cover the
 * flag spec (coercion + overrides), the settings/preset merge, the Node provider registry discovery,
 * the multi-shell completion generators, key masking, and reproducible prompt generation. Image
 * generation, the in-process backend, and provider API calls are intentionally out of scope here
 * (they need a running SD server / BYOK keys).
 */
import { describe, it, expect } from "vitest";

import {
  coerce,
  parseBool,
  ALL_FLAGS,
  overridesFromOptions,
} from "../../targets/cli/src/lib/optionSpec.js";
import { applyPreset, APP_DEFAULTS } from "../../targets/cli/src/lib/settings.js";
import { presetNames, loadPreset, resolvePresets } from "../../targets/cli/src/lib/presets.js";
import { allProviders, getProvider } from "../../targets/cli/src/lib/providers.js";
import { scriptFor, complete, COMMANDS } from "../../targets/cli/src/lib/completion.js";
import { mask } from "../../targets/cli/src/lib/keys.js";
import { generatePrompts } from "../../targets/cli/src/lib/promptRun.js";
import { engineDefaults } from "../../targets/cli/src/lib/engine.js";

describe("optionSpec.coerce", () => {
  it("coerces ints, floats, bools, and csv", () => {
    expect(coerce("5", "int")).toBe(5);
    expect(coerce("0.25", "float")).toBe(0.25);
    expect(coerce("true", "bool")).toBe(true);
    expect(coerce("no", "bool")).toBe(false);
    expect(coerce("a, b ,c", "csv")).toEqual(["a", "b", "c"]);
    expect(coerce("keyword", "string")).toBe("keyword");
  });
  it("throws on invalid numbers and bools", () => {
    expect(() => coerce("x", "int")).toThrow();
    expect(() => coerce("maybe", "bool")).toThrow();
  });
});

describe("optionSpec.parseBool", () => {
  it("accepts common truthy/falsy spellings", () => {
    for (const t of ["true", "1", "yes", "y", "on"]) expect(parseBool(t)).toBe(true);
    for (const f of ["false", "0", "no", "n", "off"]) expect(parseBool(f)).toBe(false);
  });
});

describe("optionSpec.overridesFromOptions", () => {
  it("maps only cli-sourced flags to their settings keys", () => {
    // A stub command: --count was passed on the CLI, --steps came from a default.
    const cmd = {
      getOptionValueSource: (name) =>
        name === "count" ? "cli" : name === "steps" ? "default" : undefined,
    };
    const opts = { count: "9", steps: "40" };
    const out = overridesFromOptions(cmd, opts);
    expect(out).toEqual({ keywordCount: 9 });
  });
  it("has a flag for every engine setting key it claims", () => {
    // Sanity: the spec is non-trivial and every entry has the required fields.
    expect(ALL_FLAGS.length).toBeGreaterThan(30);
    for (const f of ALL_FLAGS) {
      expect(typeof f.key).toBe("string");
      expect(typeof f.opt).toBe("string");
      expect(f.flag).toContain("--");
    }
  });
});

describe("settings.applyPreset", () => {
  it("maps legacy imageSettings keys onto the flat provider keys", () => {
    const base = { ...APP_DEFAULTS };
    const out = applyPreset(base, {
      settings: { upscaleImages: true },
      imageSettings: { width: 768, height: 512, negativePrompt: "blurry" },
    });
    expect(out.upscaleImages).toBe(true);
    expect(out.imageWidth).toBe(768);
    expect(out.imageHeight).toBe(512);
    expect(out.negativePrompt).toBe("blurry");
  });
});

describe("presets", () => {
  it("lists built-in presets and loads their shape", () => {
    const names = presetNames();
    expect(names.length).toBeGreaterThan(0);
    const p = loadPreset(names[0]);
    expect(p).toBeTypeOf("object");
  });
  it("resolves a spec and throws on an unknown name", () => {
    expect(() => resolvePresets("definitely-not-a-preset")).toThrow();
    expect(resolvePresets("")).toEqual([]);
  });
});

describe("providers registry (Node discovery)", () => {
  it("discovers providers from shared/<id>/config.js", async () => {
    const list = await allProviders();
    expect(list.length).toBeGreaterThan(20);
    const ids = list.map((p) => p.id);
    for (const id of ["plain", "openai", "midjourney", "forge", "comfyui"]) {
      expect(ids).toContain(id);
    }
  });
  it("resolves a provider by id with its manifest fields", async () => {
    const p = await getProvider("openai");
    expect(p.id).toBe("openai");
    expect(p.tier).toBe("api");
    expect(p.needsKey).toBe(true);
  });
});

describe("completion", () => {
  it("emits a script for every supported shell mentioning rap", () => {
    for (const shell of ["bash", "zsh", "fish", "powershell"]) {
      const s = scriptFor(shell);
      expect(s).toBeTypeOf("string");
      expect(s).toContain("rap");
    }
    expect(scriptFor("tcsh")).toBeNull();
  });
  it("resolves dynamic candidate kinds", async () => {
    expect(await complete("modes")).toContain("StableDiffusion");
    expect(await complete("shells")).toEqual(["bash", "zsh", "fish", "powershell"]);
    expect(await complete("commands")).toEqual(COMMANDS);
    expect((await complete("providers")).length).toBeGreaterThan(20);
  });
});

describe("keys.mask", () => {
  it("masks a secret keeping only a few visible chars", () => {
    const m = mask("sk-abcdef1234567890");
    expect(m.startsWith("sk-")).toBe(true);
    expect(m.endsWith("90")).toBe(true);
    expect(m).toContain("•");
    expect(mask("")).toBe("");
  });
});

describe("prompt generation (engine parity)", () => {
  it("is reproducible for a pinned seed", () => {
    const settings = {
      ...engineDefaults(),
      prompt: "{#animal}",
      promptCount: 3,
      randomSeed: false,
      promptSeed: "42",
    };
    const a = generatePrompts(settings);
    const b = generatePrompts(settings);
    expect(a.seed).toBe("42");
    expect(a.prompts).toHaveLength(3);
    expect(a.prompts).toEqual(b.prompts);
  });
});
