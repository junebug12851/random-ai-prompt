/**
 * Online-build mode flag + the "full version" upsell helpers.
 *
 * The deployed build (`VITE_ONLINE=true`, e.g. on Netlify at prompt.fairyfox.io) is a stripped
 * demo: it has no local machine, so the image gallery, the single-image view, the local Stable
 * Diffusion providers, and the NSFW gate can't run. Rather than hide those controls, the online
 * build shows them **disabled** with a tooltip explaining they live in the full desktop version,
 * and clicking one opens the project's GitHub page so a visitor can go get it.
 * @module gui/lib/online
 */

/** True when this is the deployed, no-local-server build (set at build time by Vite). */
export const ONLINE = import.meta.env.VITE_ONLINE === "true";

/** Where to send someone who wants the full, locally-run version. */
export const FULL_VERSION_URL = "https://github.com/junebug12851/random-ai-prompt";

/**
 * The hover tooltip for a control that's only in the full version. Takes an
 * `intl` instance (from `useIntl()`) so the sentence is localized; the `feature`
 * noun phrase should already be localized by the caller.
 * @param {import("react-intl").IntlShape} intl The react-intl instance.
 * @param {string} feature An already-localized noun phrase, e.g. "The gallery".
 * @param {string} [reason] Optional already-localized clause explaining *why*
 *   (e.g. a provider that can't be called from a browser).
 * @returns {string} The tooltip text.
 */
export function lockedHint(intl, feature, reason) {
  return intl.formatMessage(
    {
      id: "online.lockedHint",
      defaultMessage:
        "{feature} is only available in the full desktop version.{why} Click to get it on GitHub.",
      description: "Tooltip on a control disabled in the online demo build",
    },
    { feature, why: reason ? ` ${reason}` : "" },
  );
}

/** Open the full-version download page in a new tab (used when a locked control is clicked). */
export function openFullVersion() {
  window.open(FULL_VERSION_URL, "_blank", "noopener,noreferrer");
}
