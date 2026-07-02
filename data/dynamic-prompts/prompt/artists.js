/**
 * @file
 * @brief JS sidecar for artists.dpl — a random run of {artist} tokens via artistRepeater. When
 *        `settings.naturalArtistStyle` is on (default), each artist is framed "by <artist>" so a
 *        reader (and the model) can tell it's an artist rather than a style or a plain keyword.
 */

import { artistRepeater } from "../../../src/helpers/keywordRepeater.js";

/**
 * Emit a random run of artist tokens, optionally framed in natural language ("by <artist>").
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  const raw = artistRepeater("artist", true, settings); // "{artist}, {artist}" or ""
  if (!raw || settings.naturalArtistStyle === false) return raw;
  // Frame each emitted token "by {artist}"; the token resolves to a name downstream.
  return raw
    .split(", ")
    .map((tok) => `by ${tok}`)
    .join(", ");
}
