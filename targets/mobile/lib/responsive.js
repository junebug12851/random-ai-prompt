/**
 * Responsive tiers for the mobile app — the counterpart to the web's breakpoints (phone ≤768, tablet
 * 769–1024, wide >1024; see the web's `*-responsive.css`). The mandate is FULL parity with NO size-based
 * feature loss: every feature stays reachable at every size, and larger screens (tablets) get the web's
 * roomier treatment — centered reading columns and two-pane master/detail — instead of a stretched phone
 * layout. Screens read `useResponsive()` and lay themselves out from it; nothing is hidden by size.
 *
 * `resolveResponsive(width, height)` is the pure classifier (unit-tested directly); `useResponsive()` wraps
 * it over `useWindowDimensions()` so it re-runs on rotation / split-screen resize.
 * @module lib/responsive
 */
import { useWindowDimensions } from "react-native";

// Breakpoints mirror the web tiers exactly (a change here should track the web's `*-responsive.css`).
export const PHONE_MAX = 768; // ≤ this width → phone tier (single-column master/detail)
export const TABLET_MAX = 1024; // 769–1024 → tablet tier; > this → wide
// The web caps a reading column at 960px (`.main-col > * { max-width: 960px }`); mirror it so text/editor
// columns don't stretch edge-to-edge on a large tablet.
export const CONTENT_MAX_WIDTH = 960;

/**
 * Classify a viewport into the responsive tier + the derived layout flags.
 * @param {number} width Viewport width in dp.
 * @param {number} [height] Viewport height in dp (for orientation).
 * @returns {{width:number,height:number,tier:("phone"|"tablet"|"wide"),isPhone:boolean,isTablet:boolean,isWide:boolean,isTabletOrWider:boolean,twoPane:boolean,landscape:boolean,contentMaxWidth:number}}
 */
export function resolveResponsive(width, height = 0) {
  const isPhone = width <= PHONE_MAX;
  const isTablet = width > PHONE_MAX && width <= TABLET_MAX;
  const isWide = width > TABLET_MAX;
  const tier = isPhone ? "phone" : isTablet ? "tablet" : "wide";
  return {
    width,
    height,
    tier,
    isPhone,
    isTablet,
    isWide,
    isTabletOrWider: !isPhone,
    // Two-pane master/detail kicks in above the phone tier — the web shows tree+editor side by side
    // there instead of the phone's push-to-detail swap.
    twoPane: !isPhone,
    landscape: height > 0 ? width > height : false,
    contentMaxWidth: CONTENT_MAX_WIDTH,
  };
}

/**
 * The live responsive descriptor for the current viewport (re-computed on resize/rotation).
 * @returns {ReturnType<typeof resolveResponsive>}
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return resolveResponsive(width, height);
}
