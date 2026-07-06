/**
 * React hook: run the check-and-notify update check once after mount and expose the result + a
 * dismiss action for the banner. Client-only by construction — the check runs in an effect (never
 * during the online build's Node prerender), and its initial state is `null` so the first client
 * render matches the server's empty markup (no hydration mismatch). Local/desktop editions only:
 * {@link ./updateCheck.js checkForUpdate} returns `null` for the online build and for a `dev` build.
 * @module gui/lib/useUpdateCheck
 */
import { useEffect, useState } from "react";
import { checkForUpdate, dismissUpdate } from "./updateCheck.js";

/**
 * @returns {{ update: (null|{version: string, url: string, edition: string, publishedAt?: string}), dismiss: () => void }}
 *   `update` is the available release (or `null` when up to date / dismissed / not applicable);
 *   `dismiss` hides it and remembers the dismissal for this version.
 */
export function useUpdateCheck() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((u) => alive && setUpdate(u))
      .catch(() => {}); // never surface a check failure to the user
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    if (update) dismissUpdate(update.version);
    setUpdate(null);
  };

  return { update, dismiss };
}
