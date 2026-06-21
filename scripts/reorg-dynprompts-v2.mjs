/**
 * @file One-shot migration: move the v2 dynamic-prompt generators out of the flat
 * `data/dynamic-prompts/` root into category folders under a new `data/dynamic-prompts/v2/`
 * tree (scene / subject / fragment / style / engine / user), rewriting every relative
 * import (src helpers + sibling cross-references) by resolving old -> new absolute paths.
 *
 * `v1/` is left frozen and untouched. After running, stage with `git add data/dynamic-prompts`.
 * Re-running is a no-op once the source files are gone.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "data", "dynamic-prompts");

// name (no .js) -> category folder under v2/
const categoryMap = {
  // scene — full standalone scenes / places
  beach: "scene",
  cave: "scene",
  city: "scene",
  "micro-city": "scene",
  castle: "scene",
  ruins: "scene",
  house: "scene",
  "log-cabin": "scene",
  room: "scene",
  "school-room": "scene",
  "store-interior": "scene",
  storefront: "scene",
  ship: "scene",
  spaceship: "scene",
  vehicle: "scene",
  landscape: "scene",
  "micro-landscape": "scene",
  mountains: "scene",
  space: "scene",
  park: "scene",
  zoo: "scene",
  "great-bridge": "scene",
  "great-tree": "scene",
  settlement: "scene",
  futuristic: "scene",
  underwaterscape: "scene",
  // subject — entities / people / creatures / portraits
  entity: "subject",
  "entity-name": "subject",
  animal: "subject",
  person: "subject",
  "living-entity": "subject",
  furry: "subject",
  knight: "subject",
  wildlife: "subject",
  portrait: "subject",
  "portrait-animal": "subject",
  "portrait-person": "subject",
  "portrait-princess": "subject",
  // fragment — partial modifiers / garnishes
  color: "fragment",
  glow: "fragment",
  neon: "fragment",
  eerie: "fragment",
  mystical: "fragment",
  nature: "fragment",
  weather: "fragment",
  water: "fragment",
  expressive: "fragment",
  "general-state": "fragment",
  "room-state": "fragment",
  ice: "fragment",
  lava: "fragment",
  crystal: "fragment",
  underwater: "fragment",
  // style — art-style / product-render templates
  "3d-isometric": "style",
  "3d-isometric-print": "style",
  "3d-isometric-room": "style",
  "3d-print": "style",
  "lowpoly-3d-isometric": "style",
  comic: "style",
  sticker: "style",
  "funko-3d-print": "style",
  "fluffy-animal": "style",
  "needle-felt": "style",
  silhouette: "style",
  psychedelic: "style",
  "space-hologram": "style",
  "gold-pendant": "style",
  "sports-logo": "style",
  "anime-irl": "style",
  plushie: "style",
  "retro-poster": "style",
  "vibrant-art": "style",
  // engine — random generators + auto-append / special composites
  random: "engine",
  "random-prompt": "engine",
  "simple-random-prompt": "engine",
  "extra-random-prompt": "engine",
  artists: "engine",
  fx: "engine",
  danbooru: "engine",
};

// Build the old -> new absolute-path move map.
const moves = new Map(); // oldAbs -> newAbs
for (const [name, cat] of Object.entries(categoryMap)) {
  moves.set(path.join(root, `${name}.js`), path.join(root, "v2", cat, `${name}.js`));
}
// user-submitted/ -> v2/user/
moves.set(
  path.join(root, "user-submitted", "beach-merk.js"),
  path.join(root, "v2", "user", "beach-merk.js"),
);

const toPosix = (p) => p.split(path.sep).join("/");

// Rewrite the relative import specifiers in a moved file's source.
function rewrite(src, oldAbs, newAbs) {
  const oldDir = path.dirname(oldAbs);
  const newDir = path.dirname(newAbs);
  return src.replace(/(\bfrom\s*["'])([^"']+)(["'])/g, (m, pre, spec, post) => {
    if (!spec.startsWith(".")) return m; // bare package import (lodash, etc.)
    const oldTarget = path.resolve(oldDir, spec);
    const newTarget = moves.get(oldTarget) ?? oldTarget; // moved sibling, or unchanged (src/...)
    let rel = toPosix(path.relative(newDir, newTarget));
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `${pre}${rel}${post}`;
  });
}

let moved = 0;
for (const [oldAbs, newAbs] of moves) {
  if (!fs.existsSync(oldAbs)) {
    console.warn(`skip (missing): ${toPosix(path.relative(root, oldAbs))}`);
    continue;
  }
  const src = fs.readFileSync(oldAbs, "utf8");
  const out = rewrite(src, oldAbs, newAbs);
  fs.mkdirSync(path.dirname(newAbs), { recursive: true });
  fs.writeFileSync(newAbs, out);
  fs.rmSync(oldAbs);
  moved++;
}

// Drop the now-empty user-submitted/ dir if present.
const userSubmitted = path.join(root, "user-submitted");
if (fs.existsSync(userSubmitted) && fs.readdirSync(userSubmitted).length === 0)
  fs.rmdirSync(userSubmitted);

console.log(`moved ${moved} generator files into data/dynamic-prompts/v2/`);
