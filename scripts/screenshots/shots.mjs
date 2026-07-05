/**
 * @file
 * The static PNG shot list — one entry per screen. Each shot navigates the app, waits for the screen
 * to settle, and returns a screenshot buffer. Shots are viewport-aware where a screen behaves
 * differently at width (e.g. the block palette is inline on desktop but an off-canvas drawer on
 * narrow screens, so it must be opened first).
 * @module scripts/screenshots/shots
 */

/* global document -- the page.evaluate() callback below runs in the browser context. */

/** Freeze motion + hide the text caret so captures are deterministic and clean. */
const STEADY_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

/** Navigate to the app root and wait for the shell + fonts, with motion frozen. */
async function gotoHome(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: STEADY_CSS });
  await page.locator(".topbar").waitFor();
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(700);
}

/** Switch to a top-bar tab by its label, waiting for it to be enabled first. */
async function openTab(page, name) {
  const tab = page.getByRole("tab", { name });
  await tab.waitFor();
  await page.waitForFunction(
    (el) => el && el.getAttribute("aria-disabled") !== "true",
    await tab.elementHandle(),
    { timeout: 15000 },
  );
  await tab.click();
  await page.waitForTimeout(600);
}

/** A full-page screenshot at the retina static scale. */
function shootFull(page) {
  return page.screenshot({ fullPage: true, scale: "device" });
}

/**
 * The shots, in publish order. `phone`/`tablet`/`desktop` viewport handling is per-shot.
 * @type {Array<{name: string, title: string, shoot: (page: import("@playwright/test").Page, ctx: {viewport: string, width: number}) => Promise<Buffer>}>}
 */
export const SHOTS = [
  {
    name: "generate",
    title: "Generate — compose a prompt",
    async shoot(page) {
      await gotoHome(page);
      await page.locator(".composer-field").waitFor();
      return shootFull(page);
    },
  },
  {
    name: "block-menu",
    title: "Building-block palette",
    // Phone only — on tablet + desktop the palette is an inline split-pane on the Generate tab, so a
    // separate block-menu shot there just duplicates Generate. It's a distinct view only as the phone
    // off-canvas drawer. Captured with the palette expanded to full height (composer hidden, internal
    // scroll caps removed) so the whole block list is shown, uncropped.
    viewports: ["phone"],
    async shoot(page) {
      await gotoHome(page);
      await page.locator("#block-palette").waitFor();
      // Lay the palette out as the whole page at full height: drop the composer, take the drawer out
      // of its fixed/off-canvas positioning, and remove the internal max-height/scroll on the category
      // list and chip cloud — so a full-page shot shows every block instead of the clipped view.
      await page.addStyleTag({
        content: `
          .workspace.home { height: auto !important; min-height: 0 !important; grid-template-columns: 1fr !important; }
          .workspace.home .main-col { display: none !important; }
          .palette-scrim, .palette-trigger, .palette-close { display: none !important; }
          .workspace.home .sidebar, #block-palette {
            position: static !important; transform: none !important; inset: auto !important;
            width: 100% !important; min-width: 0 !important; max-width: none !important;
            height: auto !important; max-height: none !important;
            box-shadow: none !important; border-right: none !important;
          }
          .cat-tabs, .picker-list {
            max-height: none !important; overflow: visible !important; flex: none !important;
          }
        `,
      });
      await page.waitForTimeout(250);
      return shootFull(page);
    },
  },
  {
    name: "gallery",
    title: "Gallery — browse images",
    async shoot(page) {
      await gotoHome(page);
      await openTab(page, "Gallery");
      await page.locator(".view-pane.on img").first().waitFor();
      await page.waitForTimeout(300);
      return shootFull(page);
    },
  },
  {
    name: "single",
    title: "Single — one image up close",
    async shoot(page) {
      await gotoHome(page);
      await openTab(page, "Single");
      await page.locator(".g-single-body").waitFor();
      await page.locator(".view-pane.on img").first().waitFor();
      await page.waitForTimeout(300);
      return shootFull(page);
    },
  },
  {
    name: "manage",
    title: "Manage — edit the building blocks",
    async shoot(page, ctx) {
      await gotoHome(page);
      await openTab(page, "Manage");
      await page.locator(".workspace.manage .mg-sidebar").waitFor();
      // On the two-pane widths, open a block so the editor pane shows real content.
      if (ctx.width >= 770) {
        const pill = page.locator(".mg-pill.is-clickable").first();
        if (await pill.count()) {
          await pill.click();
          await page.waitForTimeout(500);
        }
      }
      return shootFull(page);
    },
  },
  {
    name: "manage-editor",
    title: "Manage — DPL block editor",
    // Phone only: Manage is master/detail on phone, so the `manage` shot shows the tree and the DPL
    // editor is hidden behind it. This one opens a block so the editor detail view is captured.
    viewports: ["phone"],
    async shoot(page) {
      await gotoHome(page);
      await openTab(page, "Manage");
      await page.locator(".workspace.manage .mg-sidebar").waitFor();
      const pill = page.locator(".mg-pill.is-clickable").first();
      await pill.waitFor();
      await pill.click();
      await page.locator(".workspace.manage .mg-main").waitFor(); // editor detail pushed into view
      await page.waitForTimeout(600); // let the CodeMirror editor + fetched content settle
      return shootFull(page);
    },
  },
];
