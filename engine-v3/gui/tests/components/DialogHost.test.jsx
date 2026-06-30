/**
 * @file Component + interaction tests for DialogHost — the in-app modal that renders the
 * `lib/dialog.js` queue and resolves each request on the user's choice (accept / cancel / Escape).
 */
import { describe, it, expect, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DialogHost from "../../src/components/DialogHost.jsx";
import { dialog, getSnapshot, settle } from "../../src/lib/dialog.js";

afterEach(() => {
  for (const d of getSnapshot()) settle(d.id, undefined);
});

describe("DialogHost", () => {
  it("shows a confirm and resolves true when the accept button is clicked", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const p = dialog.confirm({ message: "Delete it?" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete it?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await expect(p).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("resolves false when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const p = dialog.confirm({ message: "Sure?" });
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(p).resolves.toBe(false);
  });

  it("resolves false on Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const p = dialog.confirm({ message: "Sure?" });
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await expect(p).resolves.toBe(false);
  });

  it("prompt returns the typed text on accept and null on cancel", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);

    const p1 = dialog.prompt({ message: "Name?", defaultValue: "seed" });
    await screen.findByRole("dialog");
    const field = screen.getByRole("textbox");
    await user.clear(field);
    await user.type(field, "forest");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await expect(p1).resolves.toBe("forest");

    const p2 = dialog.prompt({ message: "Name?" });
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(p2).resolves.toBeNull();
  });

  it("an alert has only a dismiss button and resolves undefined", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const p = dialog.alert({ message: "Saved." });
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await expect(p).resolves.toBeUndefined();
  });

  it("uses a custom accept label when provided", async () => {
    render(<DialogHost />);
    dialog.confirm({ message: "Remove?", confirmLabel: "Delete", destructive: true });
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
