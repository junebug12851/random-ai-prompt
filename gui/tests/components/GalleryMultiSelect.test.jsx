/**
 * @file Tests for the Gallery multi-select + mass-delete flow. Renders the grid with a couple of
 * feed items, enters selection mode, selects cells, and asserts the mass-delete callback fires with
 * the chosen paths (and that select-all covers the filtered set).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import Gallery from "../../src/components/Gallery.jsx";

const items = [
  { path: "/api/output/a.png", file: "a.png", name: "a", meta: { prompt: { final: "a fox" } } },
  { path: "/api/output/b.png", file: "b.png", name: "b", meta: { prompt: { final: "a cat" } } },
];

function renderGallery(props = {}) {
  return render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <Gallery
        items={items}
        loading={false}
        query=""
        onQueryChange={() => {}}
        onOpen={() => {}}
        onRefresh={() => {}}
        onDelete={() => {}}
        {...props}
      />
    </IntlProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("Gallery multi-select", () => {
  it("has no Select control without an onDeleteMany handler", () => {
    renderGallery();
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
  });

  it("selects one image and mass-deletes it", () => {
    const onDeleteMany = vi.fn();
    renderGallery({ onDeleteMany });

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    // Cells are now toggles; pick the fox.
    fireEvent.click(screen.getByRole("button", { name: "Select: a fox" }));
    expect(screen.getByText("1 selected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete 1 image" }));
    expect(onDeleteMany).toHaveBeenCalledWith(["/api/output/a.png"]);
  });

  it("select-all covers every filtered item", () => {
    const onDeleteMany = vi.fn();
    renderGallery({ onDeleteMany });

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 selected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete 2 images" }));
    expect(onDeleteMany).toHaveBeenCalledTimes(1);
    expect(onDeleteMany.mock.calls[0][0].sort()).toEqual([
      "/api/output/a.png",
      "/api/output/b.png",
    ]);
  });

  it("renders live placeholder cells for in-flight generations", () => {
    renderGallery({ pending: [{ id: "p1", label: "a unicorn" }] });
    // The placeholder shows the prompt label (aria-hidden container, but text is present).
    expect(screen.getByText("a unicorn")).toBeTruthy();
  });
});
