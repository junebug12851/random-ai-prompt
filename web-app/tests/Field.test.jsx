/**
 * @file Component tests for the small form controls (web-app/src/components/Field.jsx).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Text, Num, Toggle, Select } from "../src/components/Field.jsx";

describe("Field.Text", () => {
  it("renders a label and emits the new string on change", () => {
    const onChange = vi.fn();
    render(<Text label="Name" value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
    expect(screen.getByText("Name")).toBeInTheDocument();
  });
});

describe("Field.Num", () => {
  it("emits a Number, or '' when cleared", () => {
    const onChange = vi.fn();
    render(<Num label="Steps" value={5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("Field.Toggle", () => {
  it("emits the checked boolean", () => {
    const onChange = vi.fn();
    render(<Toggle label="Adult" value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Field.Select", () => {
  it("renders options and emits the selected value", () => {
    const onChange = vi.fn();
    render(
      <Select label="Mode" value="StableDiffusion" onChange={onChange} options={["StableDiffusion", "NovelAI"]} />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NovelAI" } });
    expect(onChange).toHaveBeenCalledWith("NovelAI");
    expect(screen.getByRole("option", { name: "NovelAI" })).toBeInTheDocument();
  });
});
