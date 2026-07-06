/**
 * @file Unit tests for gui/src/lib/sessionKeys.js — the in-memory BYOK key store
 * and the session-then-saved key precedence.
 */
import { describe, it, expect } from "vitest";
import { getSessionKey, setSessionKey, effectiveKey } from "../../frontend/lib/sessionKeys.js";

describe("session keys", () => {
  it("returns '' for an unset provider", () => {
    expect(getSessionKey("nope-provider-xyz")).toBe("");
  });

  it("stores and reads a session key", () => {
    setSessionKey("openai", "sk-session");
    expect(getSessionKey("openai")).toBe("sk-session");
  });

  it("effectiveKey prefers the session key over the saved one", () => {
    setSessionKey("grok", "sk-session");
    expect(effectiveKey("grok", { keys: { grok: "sk-saved" } })).toBe("sk-session");
  });

  it("effectiveKey falls back to the saved key, then ''", () => {
    expect(effectiveKey("fal", { keys: { fal: "sk-saved" } })).toBe("sk-saved");
    expect(effectiveKey("bfl", { keys: {} })).toBe("");
    expect(effectiveKey("bfl", undefined)).toBe("");
  });
});
