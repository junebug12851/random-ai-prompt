/**
 * @file
 * A synthetic mouse-cursor overlay for GIF scenarios. Playwright's screenshots do NOT include the
 * real OS pointer, so a GIF that moves the mouse would show nothing moving. This injects a small
 * pointer element that tracks `page.mouse` events, plus helpers to glide it between targets (with
 * eased motion) and click — capturing a frame at each step so the movement animates smoothly.
 *
 * Install it AFTER navigation (the overlay + its listener don't survive a page load). Then use
 * {@link moveCursorTo} / {@link clickAt} inside a scenario's `run`.
 * @module scripts/screenshots/cursor
 */

/* global document, window -- the page.evaluate() callbacks below run in the browser context. */

/** Inject the cursor overlay and a mousemove listener that positions it. Call after `page.goto`. */
export async function installCursor(page, start = { x: 40, y: 40 }) {
  await page.evaluate(({ x, y }) => {
    document.getElementById("__shot_cursor")?.remove();
    const c = document.createElement("div");
    c.id = "__shot_cursor";
    c.style.cssText =
      "position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;pointer-events:none;" +
      `transform:translate(${x}px,${y}px);` +
      "filter:drop-shadow(0 1px 1px rgba(0,0,0,.45));will-change:transform;";
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3 2 L3 17 L7 13 L10 20 L13 19 L10 12 L16 12 Z" fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const move = (px, py) => {
      c.style.transform = `translate(${px}px,${py}px)`;
    };
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
  }, start);
  page.__cursorPos = { ...start };
  await page.mouse.move(start.x, start.y);
}

/** The centre point of a selector or a raw point. */
async function resolvePoint(page, target) {
  if (typeof target === "string") {
    const box = await page.locator(target).boundingBox();
    if (!box) throw new Error(`cursor: target not found: ${target}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return target;
}

/** Cubic ease-in-out. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Glide the cursor from its current position to a target, capturing a frame per step.
 * @param {import("@playwright/test").Page} page
 * @param {import("./frames.mjs").Recorder} rec
 * @param {string|{x:number,y:number}} target Selector or point.
 * @param {{steps?: number}} [opts]
 */
export async function moveCursorTo(page, rec, target, { steps = 22 } = {}) {
  const from = page.__cursorPos || { x: 0, y: 0 };
  const to = await resolvePoint(page, target);
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    await page.mouse.move(x, y);
    page.__cursorPos = { x, y };
    if (rec) await rec.frame();
  }
}

/**
 * Click at the cursor's current position (or move to a target first), holding a couple of frames.
 * @param {import("@playwright/test").Page} page
 * @param {import("./frames.mjs").Recorder} rec
 * @param {string|{x:number,y:number}} [target]
 */
export async function clickAt(page, rec, target) {
  if (target) await moveCursorTo(page, rec, target);
  const { x, y } = page.__cursorPos;
  await page.mouse.click(x, y);
  if (rec) {
    await rec.frame();
    rec.hold(2);
  }
}
