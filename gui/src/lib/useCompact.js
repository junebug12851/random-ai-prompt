/**
 * `useCompact` — a hydration-safe "is the viewport narrow (<=768px)?" hook, shared by the
 * components that swap their whole STRUCTURE between a desktop and a compact presentation
 * (the DPL insert bar's row↔menu, the header links menu's dropdown↔inline list).
 *
 * SSR-safe by design: it starts `false`, so the server render and the client's very first
 * render both draw the DESKTOP variant (no hydration mismatch), then it settles to the real
 * media-query result in an effect (effects don't run during `renderToString`). This is why a
 * CSS media query alone isn't enough for these cases — they change the React tree, not just styles.
 * @module gui/lib/useCompact
 */
import { useEffect, useState } from "react";

/**
 * @param {number} [maxWidth=768] The breakpoint (inclusive) below which the layout is "compact".
 * @returns {boolean} `true` once mounted on a viewport at or below `maxWidth`; `false` on the
 *   server and on the first client render.
 */
export function useCompact(maxWidth = 768) {
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
