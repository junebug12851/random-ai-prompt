/**
 * Mobile VISUAL parity (layer 3 of 3). The other two layers are data checks — engine/data parity
 * (metro-parity-check.mjs) and ported-catalog parity (mobile-parity-check.mjs). This one renders the
 * mobile app (its react-native-web build) at a phone width (390×844, the same width used to compare
 * against the web SPA) and screenshots each surface, so a human can eyeball UI/UX parity with the web.
 *
 * Flow: `expo export --platform web` (targets/mobile) → serve the static output → Playwright shoots
 * the Generate tab, the tab switcher targets, and the ⋯ overflow provider surfaces where the new
 * local-provider (ComfyUI/Forge/SD.Next) Server URL + settings live. PNGs land in
 * artifacts/mobile-parity/. Pass --no-build to reuse a previous export.
 *
 * Run: `npm run mobile:parity:visual`  (best-effort; logs and continues past any surface it can't hit).
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = join(ROOT, "targets/mobile");
const OUT = join(MOBILE, "dist");
const SHOTS = join(ROOT, "artifacts/mobile-parity");
const PORT = 8099;

// Device-size matrix — the mandate is "no feature loss from a size change; the whole app is available
// on any device to the extent the platform allows." So we capture every surface across the phone→tablet
// range (matching the web responsive tiers: phone ≤768, tablet 769–1024, wide >1024) rather than a
// single 390px phone. Each size writes into artifacts/mobile-parity/<size>/ so parity can be eyeballed
// per size. Pass --size=<id> to shoot just one.
const SIZES = [
  { id: "phone-small", w: 360, h: 800 }, // compact Android phone
  { id: "phone", w: 390, h: 844 }, // baseline phone (the width compared against the web SPA)
  { id: "phone-large", w: 430, h: 932 }, // large phone / phablet
  { id: "tablet-portrait", w: 834, h: 1112 }, // tablet portrait (two-pane tier on the web)
  { id: "tablet-landscape", w: 1112, h: 834 }, // tablet landscape (wide tier)
];
// Both colour schemes: the app defaults to "system" and a headless browser is LIGHT, so a
// light-only run never renders the dark canvas the design is actually built around.
// Pass --scheme=light|dark to shoot just one.
const SCHEMES = ["light", "dark"];

const noBuild = process.argv.includes("--no-build");
const sizeArg = (process.argv.find((a) => a.startsWith("--size=")) || "").split("=")[1];
const schemeArg = (process.argv.find((a) => a.startsWith("--scheme=")) || "").split("=")[1];
if (schemeArg) SCHEMES.splice(0, SCHEMES.length, schemeArg);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".ico": "image/x-icon",
};

function log(m) {
  console.log(m);
}

function build() {
  if (noBuild) {
    log("• --no-build: reusing existing export");
    return existsSync(OUT);
  }
  log("• Exporting mobile web build (expo export --platform web)…");
  // Windows: `npx` is a .cmd shim, and spawnSync can't exec it without a shell — without this the
  // export silently failed and the whole visual check degraded to "can't capture", which is how the
  // screenshots went unreviewed. Never let a broken tool look like a skipped step.
  const r = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist"], {
    cwd: MOBILE,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) log(`  ! expo export exited ${r.status}${r.error ? ` (${r.error.message})` : ""}`);
  return r.status === 0 && existsSync(OUT);
}

function serve() {
  const srv = createServer((req, res) => {
    // decodeURIComponent throws on malformed escapes (e.g. `/%`); this runs outside the fs try blocks,
    // so guard it or one bad request would crash the dev server. Fall back to the site root.
    let reqPath;
    try {
      reqPath = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      reqPath = "/";
    }
    // Path-traversal sanitizer (the form CodeQL's js/path-injection help recommends): normalize the
    // request, strip any leading `../` / `..\` segments, then join under OUT — so no user-controlled
    // path can escape the served directory.
    const safe = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, "");
    let file = join(OUT, safe);
    try {
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(OUT, "index.html");
    } catch {
      file = join(OUT, "index.html");
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => srv.listen(PORT, () => resolve(srv)));
}

// Capture every surface at one device size into artifacts/mobile-parity/<size>/ (or
// <size>-dark/ for the dark scheme).
//
// BOTH colour schemes are captured, and that is not optional. The app's theme mode defaults to
// "system" (web AND mobile — same default, so this is parity, not a bug), and a headless browser
// reports `prefers-color-scheme: light`. So a light-only capture never renders the app's PRIMARY
// look — the dark canvas (#1c1c1f) with the mint accent that the design tokens are actually built
// around. Reviewing only the light shots would leave the app's main appearance literally unseen.
async function captureSize(browser, size, scheme = "light") {
  const dir = join(SHOTS, scheme === "dark" ? `${size.id}-dark` : size.id);
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  page.on("pageerror", (e) => log(`  ! [${size.id}] page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") log(`  ! [${size.id}] console: ${m.text().slice(0, 160)}`);
  });
  const shot = async (name) => {
    await page.screenshot({ path: join(dir, `${name}.png`) });
    log(`  ✓ ${size.id}/${name}.png`);
  };
  const tap = async (label) => {
    try {
      await page.getByText(label, { exact: true }).first().click({ timeout: 3000 });
      await page.waitForTimeout(600);
      return true;
    } catch {
      log(`  · [${size.id}] couldn't tap "${label}" (skipping)`);
      return false;
    }
  };

  try {
    await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot("01-generate");

    for (const t of ["Gallery", "Single", "Manage"]) {
      if (await tap(t))
        await shot(`0${["Gallery", "Single", "Manage"].indexOf(t) + 2}-${t.toLowerCase()}`);
    }
    await tap("Generate");

    // Overflow → provider surfaces (local Server URL + knobs live here). The trigger is an SVG icon
    // button (no text) at the top-right of the one-row topbar, so click by position.
    const openOverflow = async () => {
      await page.mouse.click(size.w - 24, 42);
      await page.waitForTimeout(700);
      return page
        .locator("text=Upscale")
        .first()
        .isVisible()
        .catch(() => false);
    };
    const opened = await openOverflow();
    await shot("05-overflow");
    if (opened) {
      if (await tap("Image")) await shot("06-image-grouped");
      await tap("Image provider");
      if (await tap("Text")) await shot("07-text-role");
      await tap("Text (prompt & keyword rewrite)");
      if (await tap("Upscale")) await shot("08-upscale-role");
    } else {
      log(`  [${size.id}] couldn't open the overflow menu (skipping provider surfaces)`);
    }
  } catch (e) {
    console.error(`  ! [${size.id}] capture error: ${e?.message || e}`);
  } finally {
    await page.close();
  }
}

async function main() {
  if (!build()) {
    console.error("✗ mobile web export missing/failed — can't capture visual parity.");
    process.exit(1);
  }
  mkdirSync(SHOTS, { recursive: true });

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("✗ playwright not installed at the repo root — run `npm i` first.");
    process.exit(1);
  }

  const sizes = sizeArg ? SIZES.filter((s) => s.id === sizeArg) : SIZES;
  if (!sizes.length) {
    console.error(`✗ unknown --size=${sizeArg}. Known: ${SIZES.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const srv = await serve();
  log(`• Serving ${OUT} at http://localhost:${PORT}`);
  const browser = await chromium.launch();
  try {
    for (const size of sizes) {
      for (const scheme of SCHEMES) {
        log(`• Capturing ${size.id} (${size.w}×${size.h}) — ${scheme}`);
        await captureSize(browser, size, scheme);
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }

  log(
    `\n✓ Mobile visual-parity screenshots in artifacts/mobile-parity/<size>/ across ${sizes.length} device size(s): ${sizes
      .map((s) => s.id)
      .join(", ")}. Compare each against the web SPA at the matching width.`,
  );
}

main();
