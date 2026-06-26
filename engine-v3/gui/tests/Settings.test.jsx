/**
 * @file Component test for the capability-driven Settings backend: the provider select is
 * present, selecting a hosted (BYOK) provider reveals its key field, and the old standalone
 * "Mode" dropdown is gone (the provider now owns the dialect).
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Settings from "../src/components/Settings.jsx";
import { defaultSettings } from "../src/lib/settings.js";

function Harness() {
  const [s, setS] = useState({ ...defaultSettings });
  return <Settings settings={s} setSettings={setS} />;
}

describe("Settings — capability-driven backend", () => {
  it("renders a Provider select and no standalone Mode control", () => {
    render(<Harness />);
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.queryByText("Mode")).toBeNull();
  });

  it("reveals a BYOK key field when a hosted provider is selected", () => {
    render(<Harness />);
    const providerSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(providerSelect, { target: { value: "openai" } });
    expect(screen.getByText(/API key for OpenAI/i)).toBeTruthy();
  });
});
