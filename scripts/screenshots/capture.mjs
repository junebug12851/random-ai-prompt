/**
 * @file
 * Release-screenshot orchestrator. Builds the LOCAL edition of the SPA, serves the static `dist/`,
 * drives it with Playwright, and writes ready-to-publish PNG shots (per screen × viewport) plus the
 * registered GIF walkthroughs, an `index.json` manifest, and a browsable `index.html` gallery.
 *
 * Usage:
 *   node scripts/screenshots/capture.mjs [--build] [--out <dir>] [--skip-gifs]
 *     --build       Run `npm run web:build` first (otherwise reuse an existing gui/dist).
 *     --out <dir>   Output directory (default: <repo>/screenshots-preview). The Pages workflow
 *                   passes --out docs/jsdoc/screenshots so the images ship inside the docs site.
 *     --skip-gifs   Capture only the static PNGs (faster while iterating on shots).
 *
 * The output is published to GitHub Pages by .github/workflows/pages.yml — it is NOT committed to
 * the repo. See scripts/screenshots/README.md.
 * @module scripts/screenshots/capture
 */
import { chromium } from "@playwright/test";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VIEWPORTS,
  VIEWPORT_ORDER,
  STATIC_SCALE,
  GIF_SCALE,
  COLOR_SCHEME,
  PAGES_BASE,
  PREVIEW_PORT,
} from "./config.mjs";
import { seedContext } from "./seed.mjs";
import { SHOTS } from "./shots.mjs";
import { GIFS } from "./gifs.mjs";
import { Recorder, encodeGif } from "./frames.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const DIST = join(REPO, "gui", "dist");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const optOut = () => {
  const i = args.indexOf("--out");
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : join(REPO, "screenshots-preview");
};
const OUT = optOut();

/** Minimal content-type map for the static preview server. */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

/** Serve gui/dist with SPA fallback. `/api/*` never reaches here (Playwright route-mocks it). */
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = join(DIST, urlPath);
    if (urlPath === "/" || (!extname(urlPath) && !existsSync(file)))
      file = join(DIST, "index.html");
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((res) => server.listen(PREVIEW_PORT, () => res(server)));
}

const BASE_URL = `http://localhost:${PREVIEW_PORT}`;

/** Launch Chromium — the system Chrome channel on Windows (matches playwright.config.js). */
function launch() {
  return chromium.launch({ channel: process.platform === "win32" ? "chrome" : undefined });
}

async function captureStatics(browser, manifest) {
  for (const vp of VIEWPORT_ORDER) {
    const { width, height } = VIEWPORTS[vp];
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: STATIC_SCALE,
      colorScheme: COLOR_SCHEME,
      baseURL: BASE_URL,
    });
    await seedContext(context);
    const page = await context.newPage();
    for (const shot of SHOTS) {
      // A shot may restrict itself to certain viewports (e.g. the palette drawer is phone-only).
      if (shot.viewports && !shot.viewports.includes(vp)) continue;
      const file = `${shot.name}-${vp}.png`;
      process.stdout.write(`  · ${file} … `);
      try {
        const buf = await shot.shoot(page, { viewport: vp, width });
        writeFileSync(join(OUT, file), buf);
        const entry = manifest.shots.find((s) => s.name === shot.name);
        entry.files[vp] = file;
        console.log("ok");
      } catch (e) {
        console.log(`FAILED: ${e.message}`);
        manifest.errors.push(`${file}: ${e.message}`);
      }
    }
    await context.close();
  }
}

async function captureGifs(browser, manifest) {
  for (const gif of GIFS) {
    const vp = VIEWPORTS[gif.viewport] || VIEWPORTS.desktop;
    const file = `${gif.name}.gif`;
    process.stdout.write(`  · ${file} … `);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: GIF_SCALE,
      colorScheme: COLOR_SCHEME,
      baseURL: BASE_URL,
    });
    await seedContext(context);
    const page = await context.newPage();
    try {
      const rec = new Recorder(page, gif.clipSelector);
      await gif.run(page, rec);
      const buf = encodeGif(rec.frames, { durationMs: gif.durationMs });
      writeFileSync(join(OUT, file), buf);
      manifest.gifs.push({
        name: gif.name,
        title: gif.title,
        description: gif.description,
        viewport: gif.viewport,
        frames: rec.frames.length,
        durationMs: gif.durationMs,
        file,
      });
      console.log(`ok (${rec.frames.length} frames)`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      manifest.errors.push(`${file}: ${e.message}`);
    }
    await context.close();
  }
}

/** A small self-contained HTML index so the folder is browsable on Pages at /screenshots/. */
function renderIndexHtml(manifest) {
  const vpLabel = (vp) => VIEWPORTS[vp]?.label || vp;
  const shotBlocks = manifest.shots
    .map((s) => {
      const imgs = VIEWPORT_ORDER.filter((vp) => s.files[vp])
        .map(
          (vp) =>
            `<figure><img loading="lazy" src="${s.files[vp]}" alt="${s.title} — ${vpLabel(vp)}"><figcaption>${vpLabel(vp)}</figcaption></figure>`,
        )
        .join("");
      return `<section><h2>${s.title}</h2><div class="grid">${imgs}</div></section>`;
    })
    .join("\n");
  const gifBlocks = manifest.gifs.length
    ? `<section><h2>Walkthroughs</h2><div class="grid">${manifest.gifs
        .map(
          (g) =>
            `<figure><img loading="lazy" src="${g.file}" alt="${g.title}"><figcaption>${g.title} — ${g.description}</figcaption></figure>`,
        )
        .join("")}</div></section>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshots — random-ai-prompt v${manifest.version}</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#14161a;color:#e7e9ec;padding:2rem}
  h1{margin:0 0 .25rem}.sub{color:#9aa3ad;margin:0 0 2rem}
  h2{margin:2rem 0 .75rem;border-bottom:1px solid #2a2f36;padding-bottom:.35rem}
  .grid{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start}
  figure{margin:0;max-width:100%}
  img{max-width:min(100%,520px);height:auto;border:1px solid #2a2f36;border-radius:8px;background:#0d0f12}
  figcaption{color:#9aa3ad;font-size:.85rem;margin-top:.4rem}
</style></head><body>
<h1>random-ai-prompt — screenshots</h1>
<p class="sub">Auto-generated for v${manifest.version} · ${manifest.generatedAt}</p>
${shotBlocks}
${gifBlocks}
</body></html>`;
}

async function main() {
  if (has("--build") || !existsSync(join(DIST, "index.html"))) {
    console.log("Building the SPA (local edition) …");
    const r = spawnSync("npm", ["run", "web:build"], { cwd: REPO, stdio: "inherit", shell: true });
    if (r.status !== 0) throw new Error("web:build failed");
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const version = readFileSync(join(REPO, "VERSION"), "utf8").trim();
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    base: `${PAGES_BASE}/screenshots`,
    viewports: VIEWPORT_ORDER.map((vp) => ({ key: vp, ...VIEWPORTS[vp] })),
    shots: SHOTS.map((s) => ({ name: s.name, title: s.title, files: {} })),
    gifs: [],
    errors: [],
  };

  const server = await startServer();
  const browser = await launch();
  try {
    console.log("Capturing screens …");
    await captureStatics(browser, manifest);
    if (!has("--skip-gifs")) {
      console.log("Capturing walkthroughs …");
      await captureGifs(browser, manifest);
    }
  } finally {
    await browser.close();
    server.close();
  }

  writeFileSync(join(OUT, "index.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(OUT, "index.html"), renderIndexHtml(manifest));

  console.log(
    `\nWrote ${manifest.shots.length} screens × ${VIEWPORT_ORDER.length} viewports` +
      ` + ${manifest.gifs.length} GIF(s) to ${OUT}`,
  );
  if (manifest.errors.length) {
    console.error(`\n${manifest.errors.length} capture error(s):`);
    for (const e of manifest.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
