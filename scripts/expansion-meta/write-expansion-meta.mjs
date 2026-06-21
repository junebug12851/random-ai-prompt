/**
 * @file One-shot: write `<name>.json` sidecar metadata ({ description }) next to each
 * expansion file and each expansion category folder, for editor tooltips. The mirror
 * of scripts/list-cleanup/write-list-meta.mjs, for the `data/expansions/` tree.
 * Re-runnable.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "data", "expansions");

const D = {
  // detail / quality boosters
  "detail/legacy-detail": "Quality boosters — masterpiece, high-res, hyper-detailed (legacy set).",
  "detail/legacy-person-detail": "Highly detailed skin, for people (legacy).",
  // rendering / art-site style
  "style/pixelart": "Pixel-art look — low-res, simple, digital art.",
  "style/dap": "Art-site tags — DeviantArt, ArtStation, Pixiv.",
  // lighting / atmosphere
  "lighting/rays": "God rays — light shafts and volumetric lighting.",
  "lighting/candlelight": "Candlelit, dark interior.",
  // subjects
  "subject/coffecup": "A coffee cup / mug.",
  "subject/flower-pic": "Two random flowers in a random artist's style (pulls {flower} + {artist}).",
  // scenes
  "scene/underwater-anime-irl": "Underwater scene with bubbles (pulls in the #anime-irl prompt).",

  // category folders (tooltip on the non-clickable category pill)
  detail: "Detail & quality boosters.",
  style: "Rendering and art-site style tags.",
  lighting: "Lighting and atmosphere.",
  subject: "Subject snippets.",
  scene: "Scene / setting snippets.",
};

let wrote = 0;
for (const [name, description] of Object.entries(D)) {
  const file = path.join(root, `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ description }, null, 2) + "\n");
  wrote++;
}
console.log(`wrote ${wrote} expansion meta files`);
