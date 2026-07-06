/**
 * @file Component tests for the redesigned settings split: the gear's Settings holds only
 * non-provider prompt knobs (no Provider picker, no Mode control, no keyword/artist counts);
 * the provider's own controls render in the ProviderBox; and the BYOK key has moved out to the
 * header's ApiKeyField (one place per provider, swaps with the selection).
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "./testUtils.jsx";
import Settings from "../frontend/components/Settings.jsx";
import ProviderBox from "../frontend/components/ProviderBox.jsx";
import ProviderGear from "../frontend/components/ProviderGear.jsx";
import ProvidersMenu from "../frontend/components/ProvidersMenu.jsx";
import ApiKeyField from "../frontend/components/ApiKeyField.jsx";
import { defaultSettings } from "../frontend/lib/settings.js";

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

describe("ProviderBox — the provider's own controls (no key here)", () => {
  it("renders the provider's controls once the schema loads", async () => {
    render(<Harness Comp={ProviderBox} overrides={{ provider: "openai" }} />);
    expect(await screen.findByText("Model")).toBeTruthy();
    expect(screen.queryByText("API key")).toBeNull();
  });
});

describe("ProviderGear — provider settings behind a header gear", () => {
  it("opens a popover with the provider label + its controls", async () => {
    render(<Harness Comp={ProviderGear} overrides={{ provider: "openai" }} />);
    // Closed: the controls are not in the DOM yet.
    expect(screen.queryByText("Model")).toBeNull();
    fireEvent.click(screen.getByLabelText("Provider settings"));
    expect(screen.getByText(/OpenAI/)).toBeTruthy();
    expect(await screen.findByText("Model")).toBeTruthy();
  });

  it("works for a local provider too", () => {
    render(<Harness Comp={ProviderGear} overrides={{ provider: "forge" }} />);
    fireEvent.click(screen.getByLabelText("Provider settings"));
    expect(screen.getByText(/Forge WebUI/)).toBeTruthy();
  });
});

describe("ApiKeyField — the header BYOK key (one place, per provider)", () => {
  it("renders the key input for a BYOK provider", () => {
    render(<Harness Comp={ApiKeyField} overrides={{ provider: "openai" }} />);
    expect(screen.getByPlaceholderText(/API key/i)).toBeTruthy();
    expect(screen.getByLabelText("Save API key")).toBeTruthy();
  });

  it("renders nothing for a local / no-key provider", () => {
    const { container } = render(<Harness Comp={ApiKeyField} overrides={{ provider: "forge" }} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the Clear control only once a key is saved", () => {
    render(
      <Harness Comp={ApiKeyField} overrides={{ provider: "openai", keys: { openai: "sk-x" } }} />,
    );
    expect(screen.getByLabelText("Clear saved API key")).toBeTruthy();
  });
});

describe("ProvidersMenu — image + text providers in one dropdown", () => {
  it("opens to show an Image and a Text provider picker", () => {
    render(<Harness Comp={ProvidersMenu} overrides={{ provider: "comfyui" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Providers/i }));
    // Each row is a rich picker with its leading label.
    expect(screen.getByText("Image")).toBeTruthy();
    expect(screen.getByText("Text")).toBeTruthy();
  });

  it("renders the image provider's key field for a BYOK provider", () => {
    render(<Harness Comp={ProvidersMenu} overrides={{ provider: "openai" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Providers/i }));
    expect(screen.getByPlaceholderText(/API key/i)).toBeTruthy();
  });

  it("omits the key field for a local image provider with no rewrite", () => {
    render(<Harness Comp={ProvidersMenu} overrides={{ provider: "comfyui" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Providers/i }));
    expect(screen.queryByPlaceholderText(/API key/i)).toBeNull();
  });
});
