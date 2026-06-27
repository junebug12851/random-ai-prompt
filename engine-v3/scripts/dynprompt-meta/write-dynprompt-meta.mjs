/**
 * @file One-shot: write `<name>.json` sidecar metadata ({ description }) next to each
 * dynamic-prompt generator and each category folder, for the editor button/category
 * tooltips, for the `data/dynamic-prompts/` tree. Re-runnable.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "data", "dynamic-prompts");

const D = {
  // ---- category folders (the category-pill tooltip; describe the category itself) ----
  scene:
    "Complete scenes and places — landscapes, cityscapes, interiors, vehicles, and other full settings.",
  subject: "Subjects to depict — people, animals, creatures, and portraits.",
  fragment:
    "Garnishes that flavor a prompt — colors, lighting, weather, moods, and material accents.",
  style:
    "Art styles and product-render looks — 3D / isometric, stickers, figurines, comic, poster, and more.",
  prompt:
    "Whole-prompt builders and tag streams — random prompt generators, auto-added artists & fx, and danbooru anime tags.",
  user: "Community-submitted generators.",

  // ---- scene ----
  "scene/beach": "A beach / coastal scene — palm trees, sand, ocean.",
  "scene/cave": "A cave interior — rock formations, depth, optional ice/lava/crystal.",
  "scene/city": "A city street view — buildings, cityscape, wide shot.",
  "scene/micro-city": "A tiny, isometric-style miniature city.",
  "scene/castle": "A castle / fortress scene.",
  "scene/ruins": "Ancient ruins — crumbling architecture and overgrowth.",
  "scene/house": "A house / home exterior or setting.",
  "scene/log-cabin": "A rustic log cabin set in nature.",
  "scene/room": "A generic interior room.",
  "scene/school-room": "A classroom interior.",
  "scene/store-interior": "The inside of a shop / store.",
  "scene/storefront": "A shop exterior / storefront.",
  "scene/ship": "A sailing ship / boat scene.",
  "scene/spaceship": "A spaceship / spacecraft.",
  "scene/vehicle": "A vehicle (car and the like).",
  "scene/landscape": "A natural landscape — a wide scenic vista.",
  "scene/micro-landscape": "A tiny, miniature landscape.",
  "scene/mountains": "A mountain-range scene.",
  "scene/space": "Outer space — stars, nebulae, cosmos.",
  "scene/park": "A public park scene.",
  "scene/zoo": "A zoo with animals and enclosures.",
  "scene/great-bridge": "A grand bridge spanning a landscape.",
  "scene/great-tree": "An enormous, majestic tree.",
  "scene/settlement": "A small settlement / village.",
  "scene/futuristic": "A futuristic, sci-fi scene.",
  "scene/underwaterscape": "A full underwater scene.",

  // ---- subject ----
  "subject/entity":
    "Polymorphic subject — picks an animal, character, flower, instrument, creature, tree, or person.",
  "subject/entity-name": "Just the name/label of a random entity (no descriptors).",
  "subject/animal": "A random animal subject (entity specialized to animals).",
  "subject/person": "A random person subject (entity specialized to humans).",
  "subject/living-entity": "A random living subject (entity specialized to living things).",
  "subject/furry": "An anthropomorphic animal (furry) character.",
  "subject/knight": "An armored knight character.",
  "subject/wildlife": "Wildlife — animals in a natural setting.",
  "subject/portrait": "Portrait framing / garnish for a subject.",
  "subject/portrait-animal": "A full animal portrait.",
  "subject/portrait-person": "A full person portrait.",
  "subject/portrait-princess": "A full princess portrait.",

  // ---- fragment ----
  "fragment/color": "A random color word.",
  "fragment/glow": "A glowing / luminous accent.",
  "fragment/neon": "A neon-lighting accent.",
  "fragment/eerie": "An eerie, unsettling mood.",
  "fragment/mystical": "A mystical, magical mood.",
  "fragment/nature": "A natural-element garnish (foliage, terrain, and the like).",
  "fragment/weather": "A random weather condition.",
  "fragment/water": "A water-element garnish.",
  "fragment/expressive": "An emotional-expression garnish.",
  "fragment/general-state": "A general scene-state modifier.",
  "fragment/room-state": "An interior-state modifier.",
  "fragment/ice": "An ice / frozen accent.",
  "fragment/lava": "A lava / molten accent.",
  "fragment/crystal": "A crystal accent.",
  "fragment/underwater": "An underwater garnish (bubbles, depth).",

  // ---- style ----
  "style/3d-isometric": "Isometric 3D render style.",
  "style/3d-isometric-print": "Isometric 3D-print render style.",
  "style/3d-isometric-room": "Isometric 3D room render.",
  "style/3d-print": "3D-print render style.",
  "style/lowpoly-3d-isometric": "Low-poly isometric 3D style.",
  "style/comic": "Comic-book art style.",
  "style/sticker": "Die-cut sticker style.",
  "style/funko-3d-print": "Funko-Pop-style 3D figurine.",
  "style/fluffy-animal": "Fluffy plush-animal style.",
  "style/needle-felt": "Needle-felted craft style.",
  "style/silhouette": "Silhouette art style.",
  "style/psychedelic": "Psychedelic, trippy art style.",
  "style/space-hologram": "Holographic space render.",
  "style/gold-pendant": "Golden pendant / jewelry render.",
  "style/sports-logo": "Sports-team logo style.",
  "style/anime-irl": "Realistic anime ('IRL') style.",
  "style/plushie": "Plush-toy style.",
  "style/retro-poster": "Retro travel-poster style.",
  "style/vibrant-art": "Vivid, saturated art style.",

  // ---- prompt ----
  "prompt/random": "A composite random prompt — full scenes in AND-weighted blends.",
  "prompt/random-words": "A pile of completely random keywords (maximum chaos).",
  "prompt/simple-random": "A single, lighter random prompt suggestion.",
  "prompt/extra-random": "A total-random prompt drawing from every list.",
  "prompt/artists": "Auto-appended artist tags.",
  "prompt/fx": "Auto-appended visual-effect / quality tags.",
  "prompt/d": "Danbooru anime tag stream (general / character / meta).",

  // ---- user ----
  "user/beach-merk": "Community beach scene by Merk (composes siblings as direct imports).",
};

let wrote = 0;
for (const [name, description] of Object.entries(D)) {
  const file = path.join(root, `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ description }, null, 2) + "\n");
  wrote++;
}
console.log(`wrote ${wrote} dynamic-prompt meta files`);
