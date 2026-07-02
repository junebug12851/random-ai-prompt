/**
 * @file Component + interaction tests for PromptResult — the prompt line, generate
 * button, click-to-copy, and per-image/batch actions.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import PromptResult from "../../src/components/PromptResult.jsx";

const baseProps = {
  index: 0,
  settings: {},
  canGenerate: true,
  onGenerate: vi.fn(),
  onCopy: vi.fn(),
  onRemoveImage: vi.fn(),
  onRemoveBatch: vi.fn(),
  onClearImages: vi.fn(),
};

const prompt = (over = {}) => ({ id: "p1", text: "a fox in a forest", batches: [], ...over });

describe("PromptResult", () => {
  it("renders the prompt text and a numbered index", () => {
    render(<PromptResult {...baseProps} prompt={prompt()} number={3} />);
    expect(screen.getByText("a fox in a forest")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("calls onGenerate when the generate button is pressed", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<PromptResult {...baseProps} onGenerate={onGenerate} prompt={prompt()} />);
    await user.click(screen.getByRole("button", { name: /generate images/i }));
    expect(onGenerate).toHaveBeenCalledWith("p1");
  });

  it("hides the generate button when the provider can't render images", () => {
    render(<PromptResult {...baseProps} canGenerate={false} prompt={prompt()} />);
    expect(screen.queryByRole("button", { name: /generate images/i })).not.toBeInTheDocument();
  });

  it("click-to-copy fires onCopy with the prompt text", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<PromptResult {...baseProps} onCopy={onCopy} prompt={prompt()} />);
    await user.click(screen.getByText("a fox in a forest"));
    expect(onCopy).toHaveBeenCalledWith("a fox in a forest");
  });

  it("shows a rendering skeleton for a busy batch", () => {
    render(
      <PromptResult
        {...baseProps}
        prompt={prompt({ batches: [{ id: "b1", busy: true, count: 2, images: [] }] })}
      />,
    );
    expect(screen.getByText(/rendering/i)).toBeInTheDocument();
  });

  it("renders images and removes one via its action button", async () => {
    const user = userEvent.setup();
    const onRemoveImage = vi.fn();
    render(
      <PromptResult
        {...baseProps}
        onRemoveImage={onRemoveImage}
        prompt={prompt({ batches: [{ id: "b1", busy: false, images: ["/api/output/a.png"] }] })}
      />,
    );
    const fig = screen.getByRole("img").closest("figure");
    await user.click(within(fig).getByTitle(/remove image/i));
    expect(onRemoveImage).toHaveBeenCalledWith("p1", "b1", "/api/output/a.png");
  });

  it("offers Clear once the prompt has images and calls onClearImages", async () => {
    const user = userEvent.setup();
    const onClearImages = vi.fn();
    render(
      <PromptResult
        {...baseProps}
        onClearImages={onClearImages}
        prompt={prompt({ batches: [{ id: "b1", busy: false, images: ["/api/output/a.png"] }] })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onClearImages).toHaveBeenCalledWith("p1");
  });
});
