/**
 * @file
 * Mock-data seeding for the screenshot capture. The captured app is the real built SPA, but the
 * local-only screens (Gallery, Single, Manage) need a filesystem backend that isn't present when
 * we serve a static `dist/`. So we intercept the `/api/*` calls with Playwright routes and answer
 * them with representative sample data — enough to make each screen look alive without shipping any
 * real user content. Placeholder thumbnails are synthesized as gradients at capture time (no binary
 * assets committed).
 * @module scripts/screenshots/seed
 */
import { PNG } from "pngjs";

/** A short, evocative set of sample prompts for the gallery/single screens. */
const SAMPLE_PROMPTS = [
  "a neon-lit cyberpunk city street after rain, cinematic",
  "a serene mountain lake at dawn, soft mist, golden light",
  "a fox curled asleep in an autumn forest, warm bokeh",
  "an astronaut drifting above a glowing nebula, ultra detail",
  "a cozy bookshop interior, rain on the windows, lamplight",
  "a koi pond with lily pads, top-down, painterly",
  "a lighthouse on a stormy cliff, dramatic clouds",
  "a hummingbird mid-flight by a hibiscus, macro",
  "a desert highway at sunset, long shadows, retro",
  "a snowy village square at night, string lights, warm glow",
  "a coral reef teeming with fish, sun rays through water",
  "a hot-air balloon over rolling vineyards, morning haze",
];

/** Two seeded hues per index, for a pleasant diagonal gradient placeholder. */
function huesFor(i) {
  const a = (i * 47) % 360;
  const b = (a + 70) % 360;
  return [a, b];
}

/** Convert HSL to RGB (each 0–255). */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Synthesize a diagonal-gradient PNG placeholder thumbnail.
 * @param {number} width
 * @param {number} height
 * @param {number} seed Index that picks the colour pair (stable per image).
 * @returns {Buffer} PNG bytes.
 */
export function placeholderPng(width, height, seed) {
  const [h1, h2] = huesFor(seed);
  const [r1, g1, b1] = hslToRgb(h1, 55, 42);
  const [r2, g2, b2] = hslToRgb(h2, 60, 30);
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      const idx = (width * y + x) << 2;
      png.data[idx] = Math.round(r1 + (r2 - r1) * t);
      png.data[idx + 1] = Math.round(g1 + (g2 - g1) * t);
      png.data[idx + 2] = Math.round(b1 + (b2 - b1) * t);
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** Build the sample image feed the Gallery/Single screens read from `/api/feed`. */
function sampleFeed() {
  const now = Date.now();
  const items = SAMPLE_PROMPTS.map((prompt, i) => {
    const file = `sample-${String(i + 1).padStart(2, "0")}.png`;
    return {
      path: `/api/output/${file}`,
      file,
      name: file.replace(/\.png$/, ""),
      mtime: now - i * 3600_000,
      meta: {
        provider: "sample",
        providerLabel: "Sample",
        prompt: { dpl: prompt, roll: prompt, ai: null, final: prompt },
        negative: { dpl: "", roll: "", ai: null, final: "" },
        settings: { width: 768, height: 768, steps: 30, cfg: 7 },
        savedAt: new Date(now - i * 3600_000).toISOString(),
      },
    };
  });
  return { items };
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

  // Image bytes for every feed thumbnail / full image — a gradient keyed by the file's index.
  await context.route("**/api/output/**", (route) => {
    const m = /sample-(\d+)\.png/.exec(route.request().url());
    const seed = m ? Number(m[1]) : 1;
    route.fulfill({ contentType: "image/png", body: placeholderPng(768, 768, seed) });
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
