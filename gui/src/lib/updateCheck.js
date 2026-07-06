/**
 * Update-check core: the pure semver comparison + the client-side orchestration that asks the local
 * backend whether a newer release exists, then applies a per-version dismissal + a throttle so the
 * app never nags and never hammers the GitHub API.
 *
 * This is the **check-and-notify** foundation of the updates design
 * ({@link ../../../notes/plans/updates-upgrades.md}): the app compares its own built-in version
 * ({@link ./version.js APP_VERSION}) to the latest GitHub release tag and, if older, surfaces a
 * dismissible banner ({@link ../components/UpdateBanner.jsx}). It is **local/desktop-only** by design
 * — the hosted online build is always the newest deploy (a reload gets it), and the actual GitHub
 * fetch happens server-side in the local `/api/update` handler (the machine the user already trusts),
 * so the browser app opens no new third-party connection.
 *
 * The comparison functions are pure (no I/O, no globals) so they unit-test directly; the
 * orchestration ({@link checkForUpdate}) is the only part that touches the network + storage.
 * @module gui/lib/updateCheck
 */
import { getCached, setCached } from "../../storage/cache.js";
import { APP_VERSION } from "./version.js";
import { ONLINE } from "./online.js";

/** How long a cached check result is trusted before we ask the backend again (12 hours). */
export const CHECK_TTL_MS = 12 * 60 * 60 * 1000;

/** The storage namespace holding `{ dismissedVersion, checkedAt, latest }` (disk local / LS online). */
const NS = "update";

/**
 * Strip a leading `v`/`V` and any build/pre-release suffix, returning `[major, minor, patch]` as
 * numbers. A missing segment reads as 0; a non-numeric one reads as 0. Never throws.
 * @param {string} v A version or tag string, e.g. `"v2.43.0"`, `"2.43"`, `"2.43.1-rc.1"`.
 * @returns {[number, number, number]} The three numeric core segments.
 */
export function parseVersion(v) {
  const core = String(v ?? "")
    .trim()
    .replace(/^[vV]/, "")
    .split(/[-+]/, 1)[0]; // drop pre-release / build metadata
  const parts = core.split(".").map((n) => {
    const x = Number.parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Compare two version strings by their numeric MAJOR.MINOR.PATCH cores (pre-release/build suffixes
 * are ignored — a check-and-notify banner doesn't need to reason about rc ordering).
 * @param {string} a First version.
 * @param {string} b Second version.
 * @returns {number} `-1` if `a < b`, `1` if `a > b`, `0` if equal.
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Is `latest` a strictly newer release than `current`?
 * @param {string} latest The latest release version/tag.
 * @param {string} current The running app's version.
 * @returns {boolean} True when `latest` is newer.
 */
export function isNewer(latest, current) {
  if (!latest || !current || current === "dev") return false;
  return compareVersions(latest, current) > 0;
}

/**
 * Whether a discovered update should be shown, given what the user has already dismissed. A dismissal
 * is remembered **per version**, so dismissing 2.44.0 hides only 2.44.0 — a later 2.45.0 shows again.
 * @param {string} latest The available version.
 * @param {string} dismissedVersion The version the user last dismissed (or falsy).
 * @returns {boolean} True when the banner should appear.
 */
export function shouldShow(latest, dismissedVersion) {
  if (!latest) return false;
  if (!dismissedVersion) return true;
  // Show again only if the available version is newer than the one dismissed.
  return compareVersions(latest, dismissedVersion) > 0;
}

/** @returns {object} The persisted update state (`{}` when nothing stored yet). */
function readState() {
  return getCached(NS) || {};
}

/**
 * Persist the update state (through the app's storage layer — disk locally, localStorage online),
 * merging over what's there.
 * @param {object} patch Fields to merge in.
 * @returns {void}
 */
function writeState(patch) {
  setCached(NS, { ...readState(), ...patch });
}

/**
 * Ask the local backend whether a newer release exists, honoring a throttle + the user's dismissal.
 *
 * Returns `null` (no banner) when: this is the online build; the running version is `dev`; the
 * backend has no `/api/update` (a static host); the network fails; we're already up to date; or the
 * user has dismissed this exact version. Otherwise returns the update descriptor for the banner.
 *
 * The backend does the actual GitHub fetch (and its own short cache); this adds a client-side TTL so
 * a reload within {@link CHECK_TTL_MS} reuses the last answer without another round-trip.
 * @param {{ force?: boolean }} [opts] `force: true` bypasses the client TTL (e.g. a manual re-check).
 * @returns {Promise<{version: string, url: string, edition: string, publishedAt?: string}|null>}
 */
export async function checkForUpdate({ force = false } = {}) {
  // The hosted online edition is always the latest deploy — nothing to notify about, and we don't
  // want the browser app opening a GitHub connection. Local/desktop editions do the check.
  if (ONLINE || APP_VERSION === "dev") return null;

  const state = readState();
  let latest = state.latest;

  const fresh = latest && !force && Date.now() - (state.checkedAt || 0) < CHECK_TTL_MS;
  if (!fresh) {
    try {
      const res = await fetch("/api/update", { headers: { Accept: "application/json" } });
      if (!res.ok) return null; // no backend / not found → silently no banner
      const data = await res.json();
      latest = data && data.latest ? data.latest : null;
      writeState({ latest, edition: data?.edition, checkedAt: Date.now() });
    } catch {
      return null; // offline / no endpoint → no banner, never an error surfaced to the user
    }
  }

  if (!latest || !isNewer(latest.version, APP_VERSION)) return null;
  if (!shouldShow(latest.version, readState().dismissedVersion)) return null;
  return latest;
}

/**
 * Record that the user dismissed the banner for a specific version (so it doesn't reappear until a
 * newer one ships).
 * @param {string} version The version being dismissed.
 * @returns {void}
 */
export function dismissUpdate(version) {
  writeState({ dismissedVersion: version });
}
