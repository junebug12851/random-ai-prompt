/**
 * @file Node-suite unit tests for the dev-server folder-storage helpers (targets/web/backend/vite-api-helpers.js):
 * the traversal-safe namespace→file mapping and the read/write/remove/list round-trip, against a
 * throwaway temp folder. Lives in the Node suite (not the jsdom SPA suite) because the helper is a
 * Node-only dev-server module (uses `fileURLToPath(import.meta.url)`, which needs a real file URL).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  nsToFile,
  readNs,
  writeNs,
  removeNs,
  listNs,
} from "../../targets/web/backend/vite-api-helpers.js";

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rap-store-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("nsToFile", () => {
  it("maps a flat namespace to <dir>/<ns>.json", () => {
    expect(nsToFile("settings", dir)).toBe(path.join(dir, "settings.json"));
  });

  it("maps a slashed namespace to a subfolder", () => {
    expect(nsToFile("providers/openai", dir)).toBe(path.join(dir, "providers", "openai.json"));
  });

  it("rejects path traversal and bad segments", () => {
    expect(nsToFile("../escape", dir)).toBeNull();
    expect(nsToFile("a/../../b", dir)).toBeNull();
    expect(nsToFile("a\\b", dir)).toBeNull();
    expect(nsToFile("", dir)).toBeNull();
    expect(nsToFile("a//b", dir)).toBeNull(); // empty segment
    expect(nsToFile(null, dir)).toBeNull();
  });
});

describe("read / write / remove / list", () => {
  it("round-trips a value", () => {
    expect(writeNs("settings", { a: 1 }, dir)).toBe(true);
    expect(readNs("settings", dir)).toEqual({ a: 1 });
  });

  it("returns null for an absent or invalid namespace", () => {
    expect(readNs("nope", dir)).toBeNull();
    expect(writeNs("../bad", { a: 1 }, dir)).toBe(false);
  });

  it("creates and prunes provider subfolders", () => {
    writeNs("providers/openai", { size: "512" }, dir);
    expect(fs.existsSync(path.join(dir, "providers", "openai.json"))).toBe(true);
    removeNs("providers/openai", dir);
    expect(fs.existsSync(path.join(dir, "providers", "openai.json"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "providers"))).toBe(false); // empty subfolder pruned
  });

  it("lists every namespace with forward-slash separators", () => {
    writeNs("settings", {}, dir);
    writeNs("wrappers", {}, dir);
    writeNs("providers/openai", {}, dir);
    writeNs("providers/comfyui", {}, dir);
    expect(listNs(dir).sort()).toEqual([
      "providers/comfyui",
      "providers/openai",
      "settings",
      "wrappers",
    ]);
  });
});
