/**
 * Provider content-policy helpers. Some hosted providers are built for safe-for-work content only
 * (their config carries `contentPolicy: "sfw-only"`). We never hard-block them — instead, while the
 * app's NSFW mode is on, those providers get a soft lock (an icon + a neutral tooltip) and a
 * "proceed?" confirmation before use. The app never tells the user what they can or can't do; it
 * just surfaces that NSFW mode is on and lets them decide.
 * @module gui/lib/contentPolicy
 */

/**
 * Whether a provider declares itself safe-for-work only.
 * @param {object} provider The provider config.
 * @returns {boolean}
 */
export function isSfwOnly(provider) {
  return provider?.contentPolicy === "sfw-only";
}

/**
 * Whether a provider should be soft-locked right now: it's SFW-only and NSFW mode is on.
 * @param {object} provider The provider config.
 * @param {boolean} includeAdult Whether NSFW mode is enabled.
 * @returns {boolean}
 */
export function softLockedForNsfw(provider, includeAdult) {
  return !!includeAdult && isSfwOnly(provider);
}
