/**
 * @file
 * @brief Filesystem anchors for the CLI: repo root, output dir, user-settings dir. Resolved from
 * this module's URL so the CLI works from any cwd (unlike the engine's cwd-relative list settings —
 * see the note below).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

// targets/cli/src/lib → repo root is four levels up.
export const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** The web target root — the CLI reuses its backend (apiHandler). */
export const WEB_ROOT = path.join(REPO_ROOT, "targets", "web");

/** The cross-target shared layer — provider adapters + transport, used by every target. */
export const SHARED_ROOT = path.join(REPO_ROOT, "targets", "shared");

/** The central output folder — where generated images land, shared with the web app's gallery. */
export const OUTPUT_DIR = path.join(REPO_ROOT, "output");

/** The unified per-namespace user-settings store (shared with the web app). */
export const USER_SETTINGS_DIR = path.join(REPO_ROOT, "user", "settings");

/**
 * The engine's list/preset settings are cwd-relative (`./data/lists`), so any command that touches
 * the engine must run from the repo root. The CLI can be invoked from anywhere, so we pin the cwd
 * once at startup. Block loading is already module-relative and unaffected; this only fixes the
 * list/preset lookups. See notes/decisions/architecture.md.
 * @returns {void}
 */
export function pinCwdToRepoRoot() {
  try {
    if (process.cwd() !== path.resolve(REPO_ROOT)) process.chdir(REPO_ROOT);
  } catch {
    // best-effort: if chdir fails the user is likely already at the root, or lacks permission
  }
}
