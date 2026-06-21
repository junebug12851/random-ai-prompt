/**
 * @file One-shot: write `<name>.json` sidecar metadata ({ description }) next to each
 * dynamic-prompt generator and each category folder, for the editor button/category
 * tooltips. The mirror of scripts/expansion-meta/write-expansion-meta.mjs, for the
 * `data/dynamic-prompts/` tree. V1 generators get an auto-generated description (they
 * are frozen mirrors of the v2 set). Re-runnable.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "data", "dynamic-prompts");

const D = {
  // ---- category folders (tooltip on the category, for future folder views) ----
  v2: "Version-2 generators — the composable refactor, organized into categories.",
  "v2/scene": "Full standalone scenes & places.",
  "v2/subject": "Subjects — entities, people, creatures, portraits.",
  "v2/fragment": "Partial modifiers / garnishes composed into full prompts.",
  "v2/style": "Art-style & product-render templates (mostly publicprompts.art).",
  "v2/engine": "Random generators plus the auto-append / special composites.",
  "v2/user": "Community-submitted generators (#user-name).",
  v1: "Frozen original (v1) generators — addressed #name-v1, fx/artists baked in.",

  // ---- v2/scene ----
  "v2/scene/beach": "A beach / coastal scene — palm trees, sand, ocean.",
  "v2/scene/cave": "A cave interior — rock formations, depth, optional ice/lava/crystal.",
  "v2/scene/city": "A city street view — buildings, cityscape, wide shot.",
  "v2/scene/micro-city": "A tiny, isometric-style miniature city.",
  "v2/scene/castle": "A castle / fortress scene.",
  "v2/scene/ruins": "Ancient ruins — crumbling architecture and overgrowth.",
  "v2/scene/house": "A house / home exterior or setting.",
  "v2/scene/log-cabin": "A rustic log cabin set in nature.",
  "v2/scene/room": "A generic interior room.",
  "v2/scene/school-room": "A classroom interior.",
  "v2/scene/store-interior": "The inside of a shop / store.",
  "v2/scene/storefront": "A shop exterior / storefront.",
  "v2/scene/ship": "A sailing ship / boat scene.",
  "v2/scene/spaceship": "A spaceship / spacecraft.",
  "v2/scene/vehicle": "A vehicle (car and the like).",
  "v2/scene/landscape": "A natural landscape — a wide scenic vista.",
  "v2/scene/micro-landscape": "A tiny, miniature landscape.",
  "v2/scene/mountains": "A mountain-range scene.",
  "v2/scene/space": "Outer space — stars, nebulae, cosmos.",
  "v2/scene/park": "A public park scene.",
  "v2/scene/zoo": "A zoo with animals and enclosures.",
  "v2/scene/great-bridge": "A grand bridge spanning a landscape.",
  "v2/scene/great-tree": "An enormous, majestic tree.",
  "v2/scene/settlement": "A small settlement / village.",
  "v2/scene/futuristic": "A futuristic, sci-fi scene.",
  "v2/scene/underwaterscape": "A full underwater scene.",

  // ---- v2/subject ----
  "v2/subject/entity":
    "Polymorphic subject — picks an animal, character, flower, instrument, creature, tree, or person.",
  "v2/subject/entity-name": "Just the name/label of a random entity (no descriptors).",
  "v2/subject/animal": "A random animal subject (entity specialized to animals).",
  "v2/subject/person": "A random person subject (entity specialized to humans).",
  "v2/subject/living-entity": "A random living subject (entity specialized to living things).",
  "v2/subject/furry": "An anthropomorphic animal (furry) character.",
  "v2/subject/knight": "An armored knight character.",
  "v2/subject/wildlife": "Wildlife — animals in a natural setting.",
  "v2/subject/portrait": "Portrait framing / garnish for a subject.",
  "v2/subject/portrait-animal": "A full animal portrait.",
  "v2/subject/portrait-person": "A full person portrait.",
  "v2/subject/portrait-princess": "A full princess portrait.",

  // ---- v2/fragment ----
  "v2/fragment/color": "A random color word.",
  "v2/fragment/glow": "A glowing / luminous accent.",
  "v2/fragment/neon": "A neon-lighting accent.",
  "v2/fragment/eerie": "An eerie, unsettling mood.",
  "v2/fragment/mystical": "A mystical, magical mood.",
  "v2/fragment/nature": "A natural-element garnish (foliage, terrain, and the like).",
  "v2/fragment/weather": "A random weather condition.",
  "v2/fragment/water": "A water-element garnish.",
  "v2/fragment/expressive": "An emotional-expression garnish.",
  "v2/fragment/general-state": "A general scene-state modifier.",
  "v2/fragment/room-state": "An interior-state modifier.",
  "v2/fragment/ice": "An ice / frozen accent.",
  "v2/fragment/lava": "A lava / molten accent.",
  "v2/fragment/crystal": "A crystal accent.",
  "v2/fragment/underwater": "An underwater garnish (bubbles, depth).",

  // ---- v2/style ----
  "v2/style/3d-isometric": "Isometric 3D render style.",
  "v2/style/3d-isometric-print": "Isometric 3D-print render style.",
  "v2/style/3d-isometric-room": "Isometric 3D room render.",
  "v2/style/3d-print": "3D-print render style.",
  "v2/style/lowpoly-3d-isometric": "Low-poly isometric 3D style.",
  "v2/style/comic": "Comic-book art style.",
  "v2/style/sticker": "Die-cut sticker style.",
  "v2/style/funko-3d-print": "Funko-Pop-style 3D figurine.",
  "v2/style/fluffy-animal": "Fluffy plush-animal style.",
  "v2/style/needle-felt": "Needle-felted craft style.",
  "v2/style/silhouette": "Silhouette art style.",
  "v2/style/psychedelic": "Psychedelic, trippy art style.",
  "v2/style/space-hologram": "Holographic space render.",
  "v2/style/gold-pendant": "Golden pendant / jewelry render.",
  "v2/style/sports-logo": "Sports-team logo style.",
  "v2/style/anime-irl": "Realistic anime ('IRL') style.",
  "v2/style/plushie": "Plush-toy style.",
  "v2/style/retro-poster": "Retro travel-poster style.",
  "v2/style/vibrant-art": "Vivid, saturated art style.",

  // ---- v2/engine ----
  "v2/engine/random": "The default #random — a pile of random {keyword} pulls (maximum chaos).",
  "v2/engine/random-prompt": "A composite random suggestion (full, AND-weighted blends).",
  "v2/engine/simple-random-prompt": "A single, lighter random suggestion.",
  "v2/engine/extra-random-prompt": "A total-random suggestion drawing from every list.",
  "v2/engine/artists": "Auto-appended artist tags (#artists).",
  "v2/engine/fx": "Auto-appended visual-effect / quality tags (#fx).",
  "v2/engine/danbooru": "An anime tag stream — danbooru general / character / meta tags.",

  // ---- v2/user ----
  "v2/user/beach-merk": "Community beach scene by Merk (composes siblings as direct imports).",
};

// V1 generators are frozen mirrors of the v2 set — auto-describe any not in D above.
for (const entry of fs.readdirSync(path.join(root, "v1"), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js") || entry.name.startsWith("_")) continue;
  const base = entry.name.replace(/\.js$/, "");
  const key = `v1/${base}`;
  if (!(key in D)) D[key] = `Frozen v1 generator (#${base}-v1) — the original monolithic ${base}.`;
}

let wrote = 0;
for (const [name, description] of Object.entries(D)) {
  const file = path.join(root, `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ description }, null, 2) + "\n");
  wrote++;
}
console.log(`wrote ${wrote} dynamic-prompt meta files`);
