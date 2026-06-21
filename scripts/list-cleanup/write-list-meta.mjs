/**
 * @file One-shot: write `<list>.json` sidecar metadata ({ description }) next to each
 * project list / group / implied-group folder, for editor tooltips. Re-runnable.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "data", "lists");

const D = {
  // artist styles
  "artist/anime": "Anime / manga illustrators and styles.",
  "artist/bw": "Black-and-white, ink, and monochrome artists.",
  "artist/cartoon": "Cartoon and comic artists.",
  "artist/dhigh": "Digital painters — high detail / strong impact.",
  "artist/dmed": "Digital painters — medium impact.",
  "artist/dlow": "Digital painters — low / subtle impact.",
  "artist/fareast": "East-Asian (CJK) artists and styles.",
  "artist/fineart": "Fine-art painters, classical to modern.",
  "artist/nudity-nsfw": "Artists known for nude / erotic art (adult-gated).",
  "artist/scribbles": "Sketchy, loose, scribble-style artists.",
  "artist/secondary": "Secondary / supporting artist styles.",
  "artist/special": "Distinctive or hard-to-categorize artists.",
  "artist/ukioe": "Ukiyo-e / Japanese woodblock-print artists.",
  "artist/weird": "Surreal, weird, and experimental artists.",
  "artist/digipa": "The three digital-painting impact lists combined.",
  artist: "All Stable-Diffusion artist styles combined.",
  // brand
  "brand/organization": "Companies, brands, and institutions.",
  // danbooru
  "danbooru/d/artist": "Danbooru artist tags (anime artist handles).",
  "danbooru/d/character-c": "Danbooru copyrighted / branded characters.",
  "danbooru/d/character-nc": "Danbooru original (non-copyright) characters.",
  "danbooru/d/general-sfw": "Danbooru general descriptor tags (SFW).",
  "danbooru/d/general-nsfw": "Danbooru general tags, NSFW only (adult-gated).",
  "danbooru/d/meta": "Danbooru meta tags (medium, quality, format).",
  "danbooru/d/person": "Danbooru person / figure tags.",
  "danbooru/d/character": "All danbooru characters (copyright + original).",
  "danbooru/d/keyword": "Danbooru tags minus artists (general + characters + meta).",
  "danbooru/d": "All danbooru anime tags combined.",
  // look
  "look/action": "Poses, gestures, and activities.",
  "look/clothes-sfw": "Clothing and outfits.",
  "look/clothes-nsfw": "Lingerie, fetish, and revealing wear (adult-gated).",
  "look/color": "Colors and color descriptions.",
  "look/emotion": "Emotional states.",
  "look/expression": "Facial expressions.",
  "look/hair": "Hairstyles and hair descriptions.",
  "look/image-effect": "Photo / render effects and filters.",
  "look/instrument": "Musical instruments.",
  "look/mood": "Overall mood and atmosphere.",
  "look/size": "Size and scale descriptors.",
  "look/time": "Time of day, seasons, months, weekdays.",
  "look/view": "Camera angle, shot, and viewpoint.",
  "look/weather": "Weather and sky conditions.",
  // lore
  "lore/astronomy": "Stars, planets, and astronomical terms.",
  "lore/history": "Historical periods, eras, and events.",
  "lore/mythology": "Gods, myths, and legendary figures.",
  "lore/people-group": "Peoples, tribes, and cultural groups.",
  "lore/religion": "Religions, faiths, and religious terms.",
  "lore/work": "Named works (titles of art / media).",
  // name
  "name/anime": "Anime titles and names.",
  "name/demonym": "Demonyms — people of a place (e.g. Parisian).",
  "name/given": "First / given names.",
  "name/person": "Notable real people (surnames and full names).",
  name: "Any human name — given names, people, demonyms, anime names.",
  // nature
  "nature/animal": "Animals, breeds, and creatures.",
  "nature/flower": "Flowers and blossoms.",
  "nature/mythological-creature": "Mythical creatures and beasts.",
  "nature/planet": "Planets and moons.",
  "nature/tree": "Trees and woody plants.",
  // place
  "place/city": "Cities and towns.",
  "place/place": "Countries, regions, and landmarks.",
  // scene
  "scene/room": "Indoor room types.",
  "scene/school-room": "School and classroom settings.",
  "scene/shed": "Shed and outbuilding types.",
  "scene/ship": "Ship and boat types.",
  "scene/store": "Store and shop types.",
  "scene/vehicle": "Vehicle types.",
  // style
  "style/art-movement": "Art movements (e.g. Impressionism).",
  "style/art-technique": "Art techniques and media.",
  "style/building": "Architectural and building styles.",
  "style/construct": "Construction and structural styles.",
  "style/general": "General visual and clothing styles.",
  // word (parts of speech + extras)
  "word/adjective": "Adjectives (descriptive words).",
  "word/adverb": "Adverbs.",
  "word/interjection": "Interjections and exclamations.",
  "word/language": "Languages and writing systems.",
  "word/misc": "Function words and uncategorized terms.",
  "word/noun": "Common nouns (things and concepts).",
  "word/preposition": "Prepositions.",
  "word/verb": "Verbs (actions).",
  "word/adult-nsfw": "Explicit sexual terms (adult-gated).",
  // implied groups (folders with 2+ lists)
  look: "Any visual descriptor — color, hair, mood, pose, view, weather, and more.",
  lore: "Any lore subject — mythology, astronomy, religion, history, peoples, works.",
  nature: "Anything from nature — animals, flowers, trees, planets, mythical creatures.",
  place: "Any place — cities, countries, regions, and landmarks.",
  scene: "Any scene / setting type — rooms, ships, stores, vehicles, and more.",
  style: "Any style — art movements and techniques, building/construction/general.",
  word: "Any word — every part of speech and vocabulary list combined.",
};

let wrote = 0;
for (const [name, description] of Object.entries(D)) {
  const file = path.join(root, `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ description }, null, 2) + "\n");
  wrote++;
}
console.log(`wrote ${wrote} meta files`);
