/**
 * @file Responsive top-bar behaviour across viewports (Phase 3 of the responsive work,
 * notes/plans/responsive.md). Functional, not pixel-based, so it runs on any platform /
 * browser without committed screenshot baselines. Verifies that:
 *   - desktop shows the secondary controls inline and hides the "⋯" overflow toggle;
 *   - narrow screens collapse the controls behind the toggle, which opens a panel and
 *     dismisses on Escape / outside-click;
 *   - the phone layout drops the wordmark and never overflows the viewport horizontally.
 */
import { test, expect } from "@playwright/test";

/* global document, getComputedStyle -- the page.evaluate() callbacks run in the browser context. */

const toggle = ".topbar-overflow-toggle";
const controls = ".topbar-controls";

async function hasHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe("top bar — desktop (wide)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("controls are inline; overflow toggle is hidden", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page.locator(".brand .wordmark")).toBeVisible();
    await expect(page.locator(controls)).toBeVisible();
    await expect(page.locator(toggle)).toBeHidden();
    // Desktop triggers stay icon-only — the menu-row labels are hidden.
    await expect(page.locator(".ctl-label").first()).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("top bar — phone (narrow)", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("controls collapse behind the overflow toggle", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();

    // Wordmark dropped to reclaim width; the logo stays.
    await expect(page.locator(".brand .wordmark")).toBeHidden();
    await expect(page.locator(".brand img")).toBeVisible();

    // Toggle present, panel closed to start (SSR-safe default).
    await expect(page.locator(toggle)).toBeVisible();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(controls)).toBeHidden();

    // No horizontal overflow at phone width.
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // Open: the panel and its controls become reachable.
    await page.locator(toggle).click();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(controls)).toBeVisible();
    // Links fold inline into the menu here (no nested trigger/sheet) — a link item is reachable.
    await expect(page.locator(`${controls} .links-inline`)).toBeVisible();
    await expect(page.locator(`${controls} .links-inline .links-item`).first()).toBeVisible();
    // The menu presents labeled rows (the icon-only triggers get their text label here).
    await expect(page.locator(`${controls} .ctl-label`).first()).toBeVisible();

    // Escape dismisses.
    await page.keyboard.press("Escape");
    await expect(page.locator(controls)).toBeHidden();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");

    // Reopen, then an outside click dismisses.
    await page.locator(toggle).click();
    await expect(page.locator(controls)).toBeVisible();
    await page.locator("main").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(controls)).toBeHidden();
  });
});

test.describe("top bar — tablet (portrait)", () => {
  // A genuine tablet-portrait width (iPad Air 820) — on the tablet side of the 768/1024 split, so it
  // exercises the tablet tier's collapsed chrome rather than the phone boundary.
  test.use({ viewport: { width: 820, height: 1180 } });

  test("controls are collapsed at <= 820px", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page.locator(toggle)).toBeVisible();
    await expect(page.locator(controls)).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

// --- Phase 4a: the building-block palette becomes a phone drawer ---

const fab = ".palette-trigger";
const sidebar = "#block-palette";

/** Wait for the drawer's slide transition to settle, then return its left edge (x). */
async function sidebarX(page) {
  const box = await page.locator(sidebar).boundingBox();
  return box ? box.x : null;
}

test.describe("building-block palette — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("palette is inline; no drawer trigger", async ({ page }) => {
    await page.goto("/");
    await page.locator(sidebar).waitFor();
    await expect(page.locator(sidebar)).toBeVisible();
    await expect(page.locator(fab)).toBeHidden();
    // In-flow (left edge at/after the viewport's left origin).
    expect(await sidebarX(page)).toBeGreaterThanOrEqual(0);
  });
});

test.describe("building-block palette — phone drawer", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("palette is an off-canvas drawer opened by the trigger", async ({ page }) => {
    await page.goto("/");
    await page.locator(".workspace").waitFor();

    // Trigger present, drawer parked off-canvas to the left, composer full width.
    await expect(page.locator(fab)).toBeVisible();
    await expect(page.locator(fab)).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // Open: the drawer slides fully into view and its blocks are reachable.
    await page.locator(fab).click();
    await expect(page.locator(fab)).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
    await expect(page.locator(`${sidebar} .picker-filter`)).toBeVisible();

    // Escape dismisses it back off-canvas.
    await page.keyboard.press("Escape");
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);

    // Reopen, then the in-drawer ✕ dismisses it.
    await page.locator(fab).click();
    await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
    await page.locator(`${sidebar} .palette-close`).click();
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);

    // Reopen, then a tap on the scrim (outside the drawer) closes it — the scrim must actually
    // render and receive the click (regression: it was display:none and swallowed nothing).
    await page.locator(fab).click();
    await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
    await expect(page.locator(".palette-scrim")).toBeVisible();
    await page.mouse.click(378, 500); // right of the ~335px drawer → on the scrim
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);
  });
});

// --- Phase 4b: the Single view stacks image over metadata on narrow screens ---

const FEED = {
  items: [
    {
      path: "/api/output/responsive-test.png",
      file: "responsive-test.png",
      name: "responsive-test",
      mtime: Date.now(),
      meta: {
        provider: "test",
        providerLabel: "Test",
        prompt: { dpl: "a red fox", roll: "a red fox", ai: null, final: "a red fox" },
        settings: { width: 512, height: 512 },
        savedAt: new Date().toISOString(),
      },
    },
  ],
};

/** Number of column tracks in the single-view body grid at the current width. */
async function singleBodyColumnCount(page) {
  // Populate the local-only gallery feed so the Single view has an image to show.
  await page.route("**/api/feed", (route) => route.fulfill({ json: FEED }));
  const feedLoaded = page.waitForResponse((r) => r.url().includes("/api/feed"));
  await page.goto("/");
  await feedLoaded;
  await page.getByRole("tab", { name: "Single" }).click();
  const body = page.locator(".g-single-body");
  await body.waitFor();
  return body.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
}

test.describe("single view — desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("image + metadata are two columns", async ({ page }) => {
    expect(await singleBodyColumnCount(page)).toBe(2);
  });
});

test.describe("single view — phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("image stacks over metadata (one column, image un-stuck)", async ({ page }) => {
    expect(await singleBodyColumnCount(page)).toBe(1);
    // `relative` (not `sticky`) on phone — it drops the desktop sticky while still being a
    // containing block so the top-right overlay actions anchor to the image (not the page header).
    const pos = await page.locator(".g-single-img").evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("relative");
    // The overlay actions must anchor to the image box (offsetParent), not escape to the viewport
    // (which put them over the page header).
    const anchored = await page
      .locator(".g-single-img .img-actions")
      .evaluate((el) => el.offsetParent?.classList.contains("g-single-img") ?? false);
    expect(anchored).toBe(true);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

// --- Phase 4c: Manage becomes a master/detail on phone (and its tree isn't a stray drawer) ---

// Minimal local-mode content backend so the Manage tab unlocks and renders one entry per root.
const MANAGE_TREE = {
  blocks: { name: "blocks", dirs: [], files: ["fox.dpl"] },
  lists: { name: "lists", dirs: [], files: ["colors.txt"] },
};

async function mockManageBackend(page) {
  await page.route("**/api/manage/ping", (r) => r.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/manage/tree", (r) => r.fulfill({ json: MANAGE_TREE }));
  await page.route("**/api/manage/remote-manifest", (r) => r.fulfill({ json: {} }));
  // Serve file reads so the right-pane editors actually render (block DPL box, list entries). The
  // `.dpl`/`.txt` body carries a deliberately long line so it wraps on a narrow phone pane; a `.json`
  // sidecar 404s (no metadata), which the editors treat as "no sidecar".
  await page.route("**/api/manage/file**", (r) => {
    const path = new URL(r.request().url()).searchParams.get("path") || "";
    if (path.endsWith(".json")) return r.fulfill({ status: 404, json: { error: "no sidecar" } });
    return r.fulfill({
      json: {
        text: "---\ndescription: a deliberately long front-matter line that wraps on a narrow phone editor pane\n---\nStart\n===\n- {color}\n",
      },
    });
  });
}

async function openManage(page) {
  await mockManageBackend(page);
  await page.goto("/");
  const tab = page.getByRole("tab", { name: "Manage" });
  // The tab unlocks once the ping resolves.
  await expect(tab).not.toHaveAttribute("aria-disabled", "true");
  await tab.click();
  await page.locator(".workspace.manage .mg-sidebar").waitFor();
}

test.describe("manage — phone master/detail", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("tree fills the screen, then an entry pushes to the editor and back", async ({ page }) => {
    await openManage(page);
    const treePane = page.locator(".workspace.manage .mg-sidebar");
    const editorPane = page.locator(".workspace.manage .mg-main");

    // The tree is NOT a stray off-canvas drawer (the Home drawer must be scoped to `.workspace.home`).
    const treeBox = await treePane.boundingBox();
    expect(treeBox.x).toBeGreaterThanOrEqual(0);

    // Master: tree shown, editor hidden.
    await expect(editorPane).toBeHidden();

    // Tap an entry → detail: editor shown, tree hidden, Back control present.
    await page.locator(".mg-pill.is-clickable").first().click();
    await expect(editorPane).toBeVisible();
    await expect(treePane).toBeHidden();
    await expect(page.locator(".mg-back")).toBeVisible();

    // Back → master again.
    await page.locator(".mg-back").click();
    await expect(treePane).toBeVisible();
    await expect(editorPane).toBeHidden();
  });

  // Regression: the block editor's free-text "Modify / Draft" combo is pinned to the DPL box's
  // top-right corner on desktop, but its intended top gutter is defeated by CodeMirror's own padding,
  // so on the narrow phone pane the wrapping code ran straight under the combo. On phone it must
  // un-pin (become a static right-aligned row ABOVE the editor) so it never overlaps the code.
  test("block editor: the Modify/Draft combo clears the code, and the head fields stay usable", async ({ page }) => {
    await openManage(page);
    await page.locator(".mg-pill.is-clickable").first().click(); // first entry = the block (generator)

    const corner = page.locator(".dpl-ask-corner");
    await corner.waitFor();
    await expect(corner).toHaveCSS("position", "static"); // un-pinned on phone

    const content = page.locator(".dpl-editor-wrap .cm-content");
    await content.waitFor();
    const cornerBox = await corner.boundingBox();
    const contentBox = await content.boundingBox();
    // The combo sits entirely ABOVE the code — its bottom edge doesn't cross into the text band.
    expect(cornerBox.y + cornerBox.height).toBeLessThanOrEqual(contentBox.y + 1);

    // The editor head wraps so the name field isn't squeezed to an unreadable sliver.
    const nameBox = await page.locator(".mg-name-input").boundingBox();
    expect(nameBox.width).toBeGreaterThan(150);
  });

  // Regression: the list editor's tools row (search · Add · Sort · …) was `nowrap`, collapsing the
  // entries search to ~24px on a phone. It must wrap and give the search a usable full-width line.
  test("list editor: the entries search filter stays usable width", async ({ page }) => {
    await openManage(page);
    // The list root sits below Blocks; its entry is the last clickable pill in the tree.
    await page.locator(".mg-pill.is-clickable").last().click();
    const filter = page.locator(".mg-list-tools .picker-filter");
    await filter.waitFor();
    const box = await filter.boundingBox();
    expect(box.width).toBeGreaterThan(150);
  });
});

test.describe("manage — desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("tree and editor show together (no Back control)", async ({ page }) => {
    await openManage(page);
    await expect(page.locator(".workspace.manage .mg-sidebar")).toBeVisible();
    await expect(page.locator(".workspace.manage .mg-main")).toBeVisible();
    await expect(page.locator(".mg-back")).toBeHidden();
  });
});

// --- Tablet tier (769–1024px): compact CHROME, but the two-pane split layouts stay put ---

test.describe("tablet (iPad Pro portrait, 1024)", () => {
  test.use({ viewport: { width: 1024, height: 900 } });

  test("header chrome collapses behind the ⋯ menu (wordmark kept)", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page.locator(toggle)).toBeVisible();
    await expect(page.locator(controls)).toBeHidden();
    // Tablets keep the wordmark + full tabs (only phones <=768 drop them).
    await expect(page.locator(".brand .wordmark")).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test("Generate keeps the building-block palette as a split pane, not a drawer", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(sidebar).waitFor();
    await expect(page.locator(sidebar)).toBeVisible();
    await expect(page.locator(fab)).toBeHidden();
    expect(await sidebarX(page)).toBeGreaterThanOrEqual(0);
  });

  test("Manage keeps the two-pane split (no Back control)", async ({ page }) => {
    await openManage(page);
    await expect(page.locator(".workspace.manage .mg-sidebar")).toBeVisible();
    await expect(page.locator(".workspace.manage .mg-main")).toBeVisible();
    await expect(page.locator(".mg-back")).toBeHidden();
  });
});

// --- Regression: the composer prompt-settings gear popover on mobile ---
// Bug (fixed 2026-07-04): on <=1024px the shared `.gear-pop-scrim` gets the dark full-screen
// backdrop, but the mobile bottom-sheet rule only lifted the PROVIDER gear's pop
// (`.provider-gear .gear-pop.provider-gear-pop`) above it. The composer gear's plain `.gear-pop`
// stayed at its desktop z-index (42), so the z-90 scrim painted ON TOP of the menu — you saw a dark
// overlay over the settings and couldn't scroll/tap it. `.composer-corner` (z-index:2) also trapped
// the fixed scrim+sheet in its stacking context. The guard is a hit-test: the point over the menu
// body must resolve to the menu (not the scrim), and only the area outside the sheet is the scrim.

/** The topmost element at a viewport point, described by whether it's the menu, the scrim, or other. */
async function hitAt(page, x, y) {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py);
      if (!el) return "none";
      if (el.closest(".prompt-settings-gear .gear-pop")) return "menu";
      if (el.classList.contains("gear-pop-scrim")) return "scrim";
      return el.className || el.tagName;
    },
    [x, y],
  );
}

test.describe("composer prompt-settings gear — phone bottom sheet", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("the dark backdrop sits BEHIND the menu, which stays interactive", async ({ page }) => {
    await page.goto("/");
    await page.locator(".composer-field").waitFor();

    const gear = page.locator(".prompt-settings-gear .gear-corner");
    const pop = page.locator(".prompt-settings-gear .gear-pop");
    const scrim = page.locator(".prompt-settings-gear .gear-pop-scrim");

    await gear.click();
    await expect(pop).toBeVisible();
    await expect(scrim).toBeVisible();

    // The sheet must out-stack its own scrim (91 > 90), and the corner must not trap them.
    const z = await pop.evaluate((el) => Number(getComputedStyle(el).zIndex));
    const zScrim = await scrim.evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(z).toBeGreaterThan(zScrim);
    const cornerZ = await page
      .locator(".composer-corner")
      .evaluate((el) => getComputedStyle(el).zIndex);
    expect(cornerZ).toBe("auto");

    // Core regression: over the menu body the top element is the MENU, not the dark scrim.
    const box = await pop.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    expect(await hitAt(page, cx, cy)).toBe("menu");

    // Above the sheet, the scrim is the top element (it dims the page and catches tap-away).
    expect(await hitAt(page, box.x + box.width / 2, Math.max(2, box.y - 20))).toBe("scrim");

    // Tapping that scrim area closes the sheet.
    await page.mouse.click(box.x + box.width / 2, Math.max(2, box.y - 20));
    await expect(pop).toBeHidden();
  });
});

// --- Phase 5: touch ergonomics (emulated touch device → coarse pointer, no hover) ---

test.describe("touch ergonomics", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test("hover-only actions stay visible and key targets are >= 44px", async ({ page }) => {
    await openManage(page);

    // A touch device can't hover: the Manage entry action button must not be opacity:0.
    const act = page.locator(".mg-pill-act").first();
    await act.waitFor();
    const opacity = await act.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);

    // A primary control on this screen (the Manage refresh button) meets the 44px tap target.
    const h = await page
      .locator(".mg-refresh")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});
