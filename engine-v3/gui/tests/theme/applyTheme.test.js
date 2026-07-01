/**
 * @file Unit tests for the theme resolution + application layer.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  resolveMode,
  applyTheme,
  applyAccent,
  prefersLight,
} from "../../src/theme/applyTheme.js";

function stubMatchMedia(matches) {
  window.matchMedia = vi.fn((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  delete window.matchMedia;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

describe("theme/applyTheme", () => {
  it("resolves explicit modes as-is", () => {
    expect(resolveMode("dark")).toBe("dark");
    expect(resolveMode("light")).toBe("light");
  });

  it("normalizes an unknown mode to system (→ dark when the OS can't be read)", () => {
    expect(resolveMode("nonsense")).toBe("dark");
  });

  it("system follows the OS via matchMedia", () => {
    stubMatchMedia(true);
    expect(prefersLight()).toBe(true);
    expect(resolveMode("system")).toBe("light");

    stubMatchMedia(false);
    expect(prefersLight()).toBe(false);
    expect(resolveMode("system")).toBe("dark");
  });

  it("applyTheme writes data-theme on <html> and returns the resolved base", () => {
    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    expect(applyTheme("dark")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applyAccent writes a valid data-accent and normalizes unknown ids to mint", () => {
    expect(applyAccent("violet")).toBe("violet");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");

    expect(applyAccent("not-an-accent")).toBe("mint");
    expect(document.documentElement.getAttribute("data-accent")).toBe("mint");
  });
});
