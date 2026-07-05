/**
 * @file
 * Mock-data seeding for the screenshot capture. The captured app is the real built SPA, but the
 * local-only screens (Gallery, Single, Manage) need a filesystem backend that isn't present when we
 * serve a static `dist/`. So we intercept the `/api/*` calls with Playwright routes.
 *
 * Gallery/Single are backed by the **committed sample images** in `assets/gallery/` — real generated
 * images (optimized to JPEG) plus a sanitized `manifest.json` carrying their real prompt/metadata, so
 * the screenshots show authentic content. The manifest is scrubbed of any personal info / absolute
 * file paths. Manage still uses a small synthetic tree.
 * @module scripts/screenshots/seed
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const GALLERY_DIR = join(dirname(fileURLToPath(import.meta.url)), "assets", "gallery");
const manifest = JSON.parse(readFileSync(join(GALLERY_DIR, "manifest.json"), "utf8"));

/** The image the Single view should open (the owner's chosen hero shot). */
export const SINGLE_FILE = manifest.single;

/** Build the saved-image feed from the committed sample images + their sanitized metadata. */
function sampleFeed() {
  const now = Date.now();
  const items = manifest.items.map((it, i) => ({
    path: `/api/output/${it.file}`,
    file: it.file,
    name: it.name,
    mtime: it.savedAt ? Date.parse(it.savedAt) : now - i * 3600_000,
    meta: it.meta,
  }));
  return { items };
}

/** Content type for a served sample image. */
function imageMime(file) {
  return extname(file) === ".png" ? "image/png" : "image/jpeg";
}

/** A representative content tree for the Manage screen's left panel. */
function sampleTree() {
  return {
    "dynamic-prompts": {
      name: "dynamic-prompts",
      dirs: [
        { name: "scene", dirs: [], files: ["city.js", "forest.js", "lake.js"] },
        { name: "subject", dirs: [], files: ["fox.js", "astronaut.js"] },
        { name: "style", dirs: [], files: ["neon.js", "glow.js", "watercolor.js"] },
      ],
      files: [],
    },
    lists: {
      name: "lists",
      dirs: [{ name: "dict", dirs: [], files: ["dict-noun.txt", "dict-adj.txt"] }],
      files: ["colors.txt", "materials.txt"],
    },
  };
}

/** Sample DPL text shown in the Manage editor when a block is opened. */
const SAMPLE_DPL = `# A small scene generator — one of many building blocks.
a {glow} {neon} skyline over a {#city}
[50%] - with rain slicking the streets
[30%] - lit by passing hovercars
[<10%] - under a huge harvest moon
`;

/**
 * Register all the `/api/*` route mocks on a Playwright browser context so every page it opens
 * gets the sample backend. Call once per context, before the first navigation.
 * @param {import("@playwright/test").BrowserContext} context
 * @returns {Promise<void>}
 */
export async function seedContext(context) {
  const feed = sampleFeed();

  // The saved-image feed (Gallery + Single).
  await context.route("**/api/feed", (route) => route.fulfill({ json: feed }));

  // Image bytes for every feed thumbnail / full image — served from the committed sample set.
  await context.route("**/api/output/**", (route) => {
    const name = decodeURIComponent(route.request().url().split("?")[0].split("/").pop() || "");
    const file = join(GALLERY_DIR, name);
    if (!name || !existsSync(file) || !statSync(file).isFile()) {
      return route.fulfill({ status: 404, body: "not found" });
    }
    route.fulfill({ contentType: imageMime(name), body: readFileSync(file) });
  });

  // ImageMagick capability probe — report absent (hides the convert menu).
  await context.route("**/api/magick", (route) =>
    route.fulfill({ json: { available: false, formats: [] } }),
  );

  // Manage backend: presence probe, the content tree, per-file text, and the remote manifest.
  await context.route("**/api/manage/ping", (route) => route.fulfill({ json: { ok: true } }));
  await context.route("**/api/manage/tree", (route) => route.fulfill({ json: sampleTree() }));
  await context.route("**/api/manage/remote-manifest", (route) => route.fulfill({ json: {} }));
  await context.route("**/api/manage/file**", (route) =>
    route.fulfill({ json: { text: SAMPLE_DPL } }),
  );
  // The runtime disk snapshot: answer 404 so the engine keeps its bundled catalog (a populated
  // block palette) rather than swapping to an empty one.
  await context.route("**/api/manage/snapshot", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  // The live-reload SSE stream isn't needed for a static capture — don't leave a socket open.
  await context.route("**/api/manage/watch", (route) => route.abort());
}
