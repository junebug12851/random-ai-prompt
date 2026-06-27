/**
 * @file Component tests for the redesigned settings split: the gear's Settings holds only
 * non-provider prompt knobs (no Provider picker, no Mode control, no keyword/artist counts),
 * while the provider's own controls (incl. the BYOK key) render in the ProviderBox.
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Settings from "../src/components/Settings.jsx";
import ProviderBox from "../src/components/ProviderBox.jsx";
import { defaultSettings } from "../src/lib/settings.js";

function Harness({ Comp, overrides }) {
  const [s, setS] = useState({ ...defaultSettings, ...overrides });
  return <Comp settings={s} setSettings={setS} />;
}

describe("Settings (gear) — prompt knobs only", () => {
  it("shows vocabulary + emphasis knobs", () => {
    render(<Harness Comp={Settings} />);
    expect(screen.getByText("Keyword list")).toBeTruthy();
    expect(screen.getByText("Emphasis")).toBeTruthy();
  });

  it("no longer contains the provider picker, Mode, or keyword/artist counts", () => {
    render(<Harness Comp={Settings} />);
    expect(screen.queryByText("Provider")).toBeNull();
    expect(screen.queryByText("Mode")).toBeNull();
    expect(screen.queryByText(/Keywords \(min\)/)).toBeNull();
    expect(screen.queryByText(/Min artists/)).toBeNull();
  });
});

describe("ProviderBox — the provider's own controls", () => {
  it("is collapsed by default and reveals the BYOK key field when expanded", () => {
    render(<Harness Comp={ProviderBox} overrides={{ provider: "openai" }} />);
    // Collapsed: header shows the provider, key field hidden.
    expect(screen.getByText(/OpenAI/)).toBeTruthy();
    expect(screen.queryByText("API key")).toBeNull();
    // Expand via the header button.
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("API key")).toBeTruthy();
  });

  it("shows the local provider's header once its schema loads", async () => {
    render(<Harness Comp={ProviderBox} overrides={{ provider: "forge" }} />);
    expect(await screen.findByText(/Forge WebUI/)).toBeTruthy();
  });
});
