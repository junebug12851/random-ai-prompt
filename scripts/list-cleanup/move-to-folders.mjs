/* Copyright 2026 junebug12851 — Apache-2.0.
 * Move flat list files into organized folders. Basenames are preserved (so bare
 * {name} references still resolve via path-suffix) EXCEPT the danbooru d-* and
 * artist artist-* files, which drop their prefix. Idempotent-ish: skips missing.
 *   node scripts/list-cleanup/move-to-folders.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");

const MAP = {
  // danbooru — drop the d- prefix
  "d-general": "danbooru/general", "d-artist": "danbooru/artist",
  "d-character-c": "danbooru/character-c", "d-character-nc": "danbooru/character-nc",
  "d-meta": "danbooru/meta", "d-person": "danbooru/person",
  // artist — drop the artist- prefix
  "artist-anime": "artist/anime", "artist-bw": "artist/bw", "artist-cartoon": "artist/cartoon",
  "artist-dhigh": "artist/dhigh", "artist-dmed": "artist/dmed", "artist-dlow": "artist/dlow",
  "artist-fareast": "artist/fareast", "artist-fineart": "artist/fineart",
  "artist-nudity": "artist/nudity", "artist-scribbles": "artist/scribbles",
  "artist-special": "artist/special", "artist-ukioe": "artist/ukioe",
  "artist-weird": "artist/weird", artist2: "artist/secondary",
  // words (parts of speech, curated + dictionary) — keep basenames
  adjective: "word/adjective", adverb: "word/adverb", noun: "word/noun", verb: "word/verb",
  preposition: "word/preposition", interjection: "word/interjection",
  "dict-adjective": "word/dict-adjective", "dict-noun": "word/dict-noun",
  "dict-verb": "word/dict-verb", "dict-adverb": "word/dict-adverb", "dict-misc": "word/dict-misc",
  // names / proper nouns
  "given-name": "name/given-name", person: "name/person", demonym: "name/demonym",
  "anime-name": "name/anime-name",
  // places
  city: "place/city", place: "place/place",
  // cultural / subject knowledge
  mythology: "lore/mythology", astronomy: "lore/astronomy", religion: "lore/religion",
  history: "lore/history", work: "lore/work", "people-group": "lore/people-group",
  // nature
  animal: "nature/animal", flower: "nature/flower", tree: "nature/tree",
  planet: "nature/planet", "mythological-creature": "nature/mythological-creature",
  // look / descriptors
  color: "look/color", size: "look/size", hair: "look/hair", clothes: "look/clothes",
  weather: "look/weather", time: "look/time", mood: "look/mood", emotion: "look/emotion",
  view: "look/view", "image-effect": "look/image-effect", instrument: "look/instrument",
  // art style
  "art-movement": "style/art-movement", "art-technique": "style/art-technique",
  "general-style": "style/general-style", "construct-style": "style/construct-style",
  "building-style": "style/building-style",
  // scenes / structures
  room: "scene/room", "school-room": "scene/school-room", "shed-type": "scene/shed-type",
  "ship-type": "scene/ship-type", "store-type": "scene/store-type",
  "vehicle-type": "scene/vehicle-type",
  // brands
  organization: "brand/organization",
  // keyword leftovers
  keyword: "keyword/keyword", "keyword-adult": "keyword/keyword-adult",
};

let moved = 0;
const missing = [];
for (const [from, to] of Object.entries(MAP)) {
  const src = path.join(listsDir, `${from}.txt`);
  const dst = path.join(listsDir, `${to}.txt`);
  if (!fs.existsSync(src)) { missing.push(from); continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
  moved++;
}

// flag any .txt left at the top level (un-mapped)
const leftover = fs.readdirSync(listsDir).filter((f) => f.endsWith(".txt"));
console.log(`moved: ${moved}`);
if (missing.length) console.log(`missing (skipped): ${missing.join(", ")}`);
console.log(`still flat at top level: ${leftover.length ? leftover.join(", ") : "(none)"}`);
