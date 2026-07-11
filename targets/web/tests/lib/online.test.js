/**
 * @file Unit tests for gui/src/lib/online.js — the online-build flag + locked-feature helpers.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createIntl, createIntlCache } from "react-intl";
import { ONLINE, FULL_VERSION_URL, lockedHint, openFullVersion } from "../../frontend/lib/online.js";

const intl = createIntl({ locale: "en", defaultLocale: "en" }, createIntlCache());

afterEach(() => vi.restoreAllMocks());

describe("online flags", () => {
  it("ONLINE is false in the test (non-online) build", () => {
    expect(ONLINE).toBe(false);
  });
  it("points the full version at the GitHub repo", () => {
    expect(FULL_VERSION_URL).toMatch(/github\.com\/1fairyfox\/random-ai-prompt/);
  });
});

describe("lockedHint", () => {
  it("includes the feature and a GitHub call to action", () => {
    const hint = lockedHint(intl, "The gallery");
    expect(hint).toContain("The gallery");
    expect(hint).toContain("GitHub");
  });
  it("appends an optional reason clause", () => {
    expect(lockedHint(intl, "X", "It needs a local server.")).toContain("It needs a local server.");
  });
});

describe("openFullVersion", () => {
  it("opens the full-version URL in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openFullVersion();
    expect(open).toHaveBeenCalledWith(FULL_VERSION_URL, "_blank", "noopener,noreferrer");
  });
});
