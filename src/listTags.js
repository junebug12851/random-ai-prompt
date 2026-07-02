/**
 * @file
 * @brief Per-list metadata (category + anime/nsfw flags) for the UI and documentation. Pure data;
 * it does not gate anything by itself (gating lives in gatedLists.js). Browser-safe.
 */

/**
 * Per-list metadata. Any list not listed here defaults to
 * { anime:false, nsfw:false }. `nsfw:true` means the list as a whole leans
 * adult (still drawn only when includeAdult is on if it is also gated).
 * @type {Object<string, {category: (string|undefined), anime: (boolean|undefined), nsfw: (boolean|undefined)}>}
 */
export const listTags = {
  // danbooru / anime content (files live under danbooru/d/, short ref "d/<name>").
  // Plain names are SFW; `-nsfw` / `-nsfw-only` carry NSFW and are gated.
  "danbooru/d": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/general": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/general-nsfw": { category: "danbooru", anime: true, nsfw: true },
  "danbooru/d/artist": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-c": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/character-nc": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/meta": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/keyword": { category: "danbooru", anime: true, nsfw: false },
  "danbooru/d/person": { category: "danbooru", anime: true, nsfw: false },
  "keyword/keyword-nsfw": { category: "keyword", anime: false, nsfw: true },
  "artist/anime": { category: "artist", anime: true, nsfw: false },
  "name/anime": { category: "subject", anime: true, nsfw: false },
  "artist/nudity-nsfw": { category: "artist", anime: false, nsfw: true },

  // uncategorized leftover words (function words, obscure terms WordNet lacks)
  "word/misc": { category: "pos", anime: false, nsfw: false },

  // proper-noun categories (hand-classified from the old keyword.txt dump)
  "name/demonym": { category: "subject", anime: false, nsfw: false },
  "name/given": { category: "name", anime: false, nsfw: false },
  "name/person": { category: "name", anime: false, nsfw: false },
  "place/place": { category: "place", anime: false, nsfw: false },
  "brand/organization": { category: "brand", anime: false, nsfw: false },
  "lore/mythology": { category: "subject", anime: false, nsfw: false },
  "lore/astronomy": { category: "subject", anime: false, nsfw: false },
  "lore/people-group": { category: "subject", anime: false, nsfw: false },
  "lore/religion": { category: "subject", anime: false, nsfw: false },
  "lore/history": { category: "subject", anime: false, nsfw: false },
  "lore/work": { category: "subject", anime: false, nsfw: false },

  // face/expression/pose tags + gated adult relocations
  "look/expression": { category: "expression", anime: false, nsfw: false },
  "look/action": { category: "action", anime: false, nsfw: false },
  "look/clothes-nsfw": { category: "look", anime: false, nsfw: true },
  "word/adult-nsfw": { category: "pos", anime: false, nsfw: true },
};
