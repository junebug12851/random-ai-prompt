/**
 * @file
 * @brief JS sidecar for styles.dpl — a random run of {style} tokens (art movements / techniques).
 *        When `settings.naturalArtistStyle` is on (default), each is framed "in the style of <style>"
 *        so it reads as a style rather than an artist or a plain keyword. The companion to artists.js.
 */

import { randomInt } from "../../../src/helpers/random.js";

/**
 * Emit one or two style tokens, optionally framed in natural language ("in the style of <style>").
 * @param {object} settings The settings.
 * @returns {string} The generated prompt fragment.
 */
export default function (settings) {
  const count = randomInt(1, 2);
  const tokens = Array.from({ length: count }, () => "{style}");
  if (settings.naturalArtistStyle === false) return tokens.join(", ");
  // Frame each emitted token "in the style of {style}"; the token resolves to a style downstream.
  return tokens.map((tok) => `in the style of ${tok}`).join(", ");
}
