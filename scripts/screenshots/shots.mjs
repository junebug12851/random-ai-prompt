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
    async shoot(page) {
      await gotoHome(page);
      await page.locator(".workspace").waitFor();
      // Narrow screens park the palette off-canvas — open it via its trigger so the full-page shot
      // shows it in view. On desktop it's already inline.
      const trigger = page.locator(".palette-trigger");
      if (await trigger.isVisible()) {
        await trigger.click();
        await page.waitForTimeout(450); // slide-in settle
      }
      await page.locator("#block-palette").waitFor();
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
      if (ctx.width >= 769) {
        const pill = page.locator(".mg-pill.is-clickable").first();
        if (await pill.count()) {
          await pill.click();
          await page.waitForTimeout(500);
        }
      }
      return shootFull(page);
    },
  },
];
