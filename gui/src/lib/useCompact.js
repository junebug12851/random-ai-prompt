/**
 * `useCompact` — a hydration-safe "is the viewport at/below the compact-chrome width (<=1024px)?"
 * hook, shared by the components that swap their whole STRUCTURE between a roomy desktop and a
 * space-saving compact presentation (the DPL insert bar's row↔menu, the header links menu's
 * dropdown↔inline list, the inline image controls' inline Size↔cog).
 *
 * The 1024px boundary is the "compact CHROME" line: it covers phones AND tablets (iPad Air 820,
 * Surface 912, iPad Pro 1024, …), which don't have desktop's horizontal room for the full inline
 * chrome. It is deliberately WIDER than the layout-collapse line (<=768px, CSS-only) that turns the
 * two-pane Generate/Manage workspaces into a phone drawer / master-detail — tablets keep the split
 * panes but borrow the compact chrome.
 *
 * SSR-safe by design: it starts `false`, so the server render and the client's very first
 * render both draw the DESKTOP variant (no hydration mismatch), then it settles to the real
 * media-query result in an effect (effects don't run during `renderToString`). This is why a
 * CSS media query alone isn't enough for these cases — they change the React tree, not just styles.
 * @module gui/lib/useCompact
 */
import { useEffect, useState } from "react";

/**
 * @param {number} [maxWidth=1024] The breakpoint (inclusive) below which the chrome is "compact".
 * @returns {boolean} `true` once mounted on a viewport at or below `maxWidth`; `false` on the
 *   server and on the first client render.
 */
export function useCompact(maxWidth = 1024) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidth]);
  return compact;
}
