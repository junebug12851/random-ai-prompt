/**
 * @file Unit test for the shared Node engine boot (`engine/nodeEngine.js`) — that it boots the one
 * engine idempotently and exposes the catalog helpers the CLI + backend rely on.
 */
import { describe, it, expect } from "vitest";
import {
  bootNodeEngine,
  setActiveSettings,
  engineDefaults,
  blockNames,
  listNames,
  blockTokens,
  pickerLists,
  nodeLoader,
} from "../../engine/nodeEngine.js";

describe("nodeEngine", () => {
  it("boots once (idempotent) and exposes the catalog helpers", () => {
    setActiveSettings({ includeAdult: false });
    const engine = bootNodeEngine();
    expect(typeof engine.generate).toBe("function");
    expect(bootNodeEngine()).toBe(engine); // idempotent — same instance

    expect(engineDefaults()).toBeTypeOf("object");
    expect(blockNames().length).toBeGreaterThan(0);
    expect(listNames().length).toBeGreaterThan(0);
    expect(blockTokens().length).toBeGreaterThan(0);
    expect(pickerLists().length).toBeGreaterThan(0);
    expect(nodeLoader).toBeTruthy();
  });
});
