/**
 * @file Component tests for ThemeProvider: it applies the mode to <html>,
 * follows the OS live in system mode, normalizes bad input, and forwards setMode.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../../src/theme/ThemeProvider.jsx";

/** A matchMedia stub whose match state can be flipped to fire "change". */
function stubMatchMedia(matches) {
  const listeners = new Set();
  const mql = {
    matches,
    media: "(prefers-color-scheme: light)",
    addEventListener: (_event, cb) => listeners.add(cb),
    removeEventListener: (_event, cb) => listeners.delete(cb),
    emit(next) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
  window.matchMedia = vi.fn(() => mql);
  return mql;
}

afterEach(() => {
  delete window.matchMedia;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

function Probe() {
  const { mode, resolvedMode } = useTheme();
  return <div data-testid="probe" data-mode={mode} data-resolved={resolvedMode} />;
}

describe("ThemeProvider", () => {
  it("applies an explicit mode to <html data-theme>", () => {
    const { getByTestId } = render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(getByTestId("probe").getAttribute("data-resolved")).toBe("light");
  });

  it("system follows the OS and updates live when it flips", () => {
    const mql = stubMatchMedia(true); // OS currently prefers light
    render(
      <ThemeProvider mode="system">
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => mql.emit(false)); // OS flips to dark
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("normalizes an unknown mode to system", () => {
    render(
      <ThemeProvider mode="bogus">
        <Probe />
      </ThemeProvider>,
    );
    // No matchMedia stub → system resolves to dark.
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applies the accent to <html data-accent> and forwards a normalized setAccent", () => {
    const setAccent = vi.fn();
    let api;
    function Grab() {
      api = useTheme();
      return null;
    }
    render(
      <ThemeProvider mode="dark" accent="cyan" setAccent={setAccent}>
        <Grab />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute("data-accent")).toBe("cyan");
    act(() => api.setAccent("amber"));
    expect(setAccent).toHaveBeenCalledWith("amber");
    act(() => api.setAccent("nope"));
    expect(setAccent).toHaveBeenCalledWith("mint");
  });

  it("setMode forwards a normalized value to the persisted setter", () => {
    const setMode = vi.fn();
    let api;
    function Grab() {
      api = useTheme();
      return null;
    }
    render(
      <ThemeProvider mode="dark" setMode={setMode}>
        <Grab />
      </ThemeProvider>,
    );
    act(() => api.setMode("light"));
    expect(setMode).toHaveBeenCalledWith("light");
    act(() => api.setMode("garbage"));
    expect(setMode).toHaveBeenCalledWith("system");
  });
});
