/**
 * @file
 * GIF scenario: typing a handful of building-block references into the prompt box, so a viewer sees
 * the composition language in action. Frames are captured as each character lands; the encoder pads
 * the run out to the requested 5-second duration.
 * @module scripts/screenshots/scenarios/prompt-blocks
 */

/* global document -- the page.evaluate() callback in run() executes in the browser context. */

/** The block references typed into the composer. */
const TEXT = "{#prompt/simple-random}, {#futuristic}, {#glow}, {#neon}, {#city}";

/** @type {import("../gifs.mjs").GifScenario} */
export default {
  name: "prompt-blocks",
  title: "Composing with building blocks",
  description: "Typing block references into the prompt box.",
  viewport: "desktop",
  durationMs: 5000,
  // Capture the full 1025×768 desktop frame (clipSelector null). The diff-based encoder keeps it
  // small because only the prompt-box text region changes frame-to-frame.
  clipSelector: null,

  /**
   * @param {import("@playwright/test").Page} page
   * @param {import("../frames.mjs").Recorder} rec
   */
  async run(page, rec) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({
      content: "*,*::before,*::after{transition:none!important;animation:none!important}",
    });
    await page.locator(".composer-field").waitFor();
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(500);

    const editor = page.locator(".prompt-input .cm-content");
    await editor.click();
    // Clear the default prompt so the box types exactly our string.
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await rec.frame(); // empty box

    // One character per frame → the typing reads smoothly (each glyph appears in its own frame). The
    // short pause after each keystroke lets CodeMirror's autocomplete popup render before the frame is
    // captured (it opens ~100ms after typing), so the token suggestions show up in the animation.
    for (const ch of TEXT) {
      await page.keyboard.type(ch, { delay: 0 });
      await page.waitForTimeout(140);
      await rec.frame();
    }

    // Pause on the finished prompt so the loop reads clearly.
    rec.hold(6);
  },
};
