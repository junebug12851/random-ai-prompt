# Responsive / Adaptive UI — Plan

**Status:** in progress on `feature/responsive-foundation`. Phase 1 (fluid tokens) ✅, Phase 2 (adopt
the `layout` layer) ✅, Phase 3 (responsive top bar) ✅, Phase 4a (Home drawer) ✅, Phase 4b (Single view stack) ✅, and
Phase 4c (Manage master/detail) ✅, and Phase 5 (touch ergonomics) ✅ landed — **all views are
responsive and touch-ready**; Phase 6 (final verification / release) in progress.
**Scope:** the whole `gui/` SPA — every top-level view (Home / Gallery / Single / Manage), the top bar,
and the shared shell. **No feature is removed at any width.** Features *relocate* (drawer, overflow
menu, stacked pane, sticky action bar); they never disappear. Applies to both editions — the local build
and the online build — so anyone on any device gets the full, flexible interface.

---

## 1. Goal & the guiding principle

Make the interface **fluid** (it breathes continuously as the window changes size) **and adaptive** (it
switches to distinct tablet / phone layouts where continuous reflow isn't enough), from a phone up to a
wide desktop, with **zero loss of capability** when the screen shrinks.

The principle that guarantees "no lost features": on a smaller screen a feature **changes its container,
not its existence**. The Home sidebar palette becomes a drawer/bottom-sheet. The top-bar control pile
(Providers, provider gear, NSFW, theme, links) collapses behind **one top overflow menu** (the chosen
nav pattern — see §5). A two-pane view (Single, Manage) becomes one pane with a toggle. Same components,
same state, same abilities — re-homed.

---

## 2. Where the app was before this work

Effectively desktop-only. Three real breakpoints existed in the entire stylesheet:

- `styles/components/responsive.css` — stacks Home's `.workspace` to one column at `≤860px`.
- `styles/components/gallery-single-image-derived.css` — `≤720px`.
- `styles/components/wrapper.css` — `≤620px`.

Everything else was fixed. The concrete breakages on a phone/tablet:

- **Top bar** (`title-bar.css`): one flex row = brand + wordmark + a 4-tab switch + Providers + gear +
  NSFW + theme + links. Overflows below ~700px.
- **`.app { height: 100vh }`** (`app-frame.css`): the mobile URL-bar bug (content hidden under the bar).
- **Two-pane views**: Home's `.workspace` grid (`minmax(240px,300px) 1fr`), plus Single and Manage,
  assume desktop width.
- **No fluid scale**: spacing/type were hardcoded rem literals (`0.6rem 1.1rem`, `font-size: 0.82rem`).
  Layouts *snapped* at breakpoints instead of scaling between them.
- **Touch**: tap targets (e.g. `.vs-tab`, ~0.3rem padding) below the 44px thumb minimum; many
  `:hover`-only affordances with no touch equivalent.

Two existing assets make this clean:

- A **primitive → semantic token system** (`foundation/tokens.css`) — the right place to add scales.
- An **empty `layout` cascade layer** already declared in `index.css`
  (`@layer reset, tokens, base, layout, components, utilities, theme, overrides`) — the purpose-built,
  correct-precedence home for responsive layout, needing no refactor to adopt.

---

## 3. The two techniques (and why both)

1. **Fluid foundation** — `clamp()` type + spacing scales and **container queries**, so regions scale
   continuously with no dead zones.
2. **Deliberate layout modes** — a small set of breakpoints (tablet / phone) only where a region must
   *change shape* (top bar, sidebar, two-pane views).

**Container queries over viewport media queries for component internals.** All three main views stay
**mounted** at once (switched by CSS `display` — see `App.jsx` / `workspace.css`), and the tablet story
often wants a pane to adapt to *its own* width, not the window's. `@container` lets each region (palette,
results, single-image detail, manage tree) respond to the space it actually has. It's pure CSS, so it's
SSR-safe. Media queries remain for true window-level mode switches (top bar, global nav).

**Where container contexts may live (safety constraint, found in Phase 2).** `container-type` implies
`contain: layout`, which makes the element the **containing block for `position: fixed` descendants**.
Several fixed-positioned popovers render *inside* Home's pane (`.hover-tip`, the DPL insert toolbar, the
prompt-settings gear popover — all positioned viewport-relative by JS). So we **must not** put
`container-type` on `.view-pane` / `.main-col` / any wrapper that contains those popovers — it would
break their positioning. Container contexts therefore go on **leaf wrappers** (a card, a results list, a
detail table) that don't enclose a fixed popover, established per-component in Phases 3–4.

---

## 4. The hard constraint: prerender + hydration

The online build **prerenders first paint and `hydrateRoot`s it** (`gui/scripts/build.mjs`,
`entry-server.jsx`), and `CLAUDE.md` is emphatic: the initial render must not touch
`window` / `matchMedia` / `document` / `localStorage`. A `useIsMobile()` hook that *chooses a layout in
JS* would render the desktop tree on the server and a phone tree on the client → **hydration mismatch**.

Therefore the backbone is **CSS-first**: the layout is correct at any width from the first painted byte,
because media/container queries resolve during layout, not in a React render pass. JS breakpoint state is
allowed **only post-hydration** and **only** for genuinely stateful behavior (is the overflow menu open?),
driven by an effect — never by the initial render. `tests/prerender.test.js` and warning-free hydration
stay green.

---

## 5. Navigation pattern (decided)

**Top overflow menu only.** On phones the secondary controls (Providers, provider gear, NSFW, theme,
links) collapse behind a single top "⋯"/menu affordance; the primary view switch stays at the top,
condensed. This keeps today's top-anchored structure (least structural churn, no new bottom bar) while
fitting a narrow screen. Tablet keeps controls inline where they fit; desktop is unchanged.

---

## 6. Phased build

Each phase is independently shippable and **desktop-neutral** (existing desktop rendering unchanged —
`clamp()` maxes equal today's fixed values, so wide viewports clamp to the current look).

**Phase 1 — Fluid foundation (tokens).** _(this branch)_
Add a fluid **type scale** and **spacing + gutter** tokens to `foundation/tokens.css`; document
**breakpoint** conventions. Swap `100vh → 100dvh` (with a `vh` fallback) in `app-frame.css`. Wire the
fluid gutter into the top bar and `.main-col` padding (desktop-neutral clamp; tightens on narrow).
Nothing else keys off them yet — pure, safe foundation.

**Phase 2 — Adopt the `layout` layer.** ✅ Moved the app frame + top-level view/grid skeleton (`.app`,
`main`, `.view-pane`, `.workspace`, `.sidebar`, `.main-col`) into `styles/layout/` at `layer(layout)`;
rewired `index.css`. The responsive overrides stay in `components` (they target component-internal
selectors and must win). Container contexts were **not** placed on the panes — see the safety constraint
above; they'll be established on leaf wrappers in Phases 3–4. Desktop rendering unchanged (no selector
collisions; precedence preserved).

**Phase 3 — Top bar → responsive nav.** ✅ The secondary control pile (Providers, gear, NSFW, theme,
links) is wrapped in `.topbar-overflow`: `display:contents` on wide screens (inline, byte-identical to
before — verified by the visual-regression baselines), and at `≤820px` it collapses behind a `⋯` toggle
(`MoreIcon`) into an anchored dropdown panel. Panel visibility is width-driven CSS; the open state is the
toggle's `[aria-expanded]`, flipped on click **post-hydration**, so first paint stays SSR-safe (the
`prerender.test.js` guard passes). Controls render **once** (no duplicated state / fixed popovers).
Dismisses on Escape + outside `pointerdown`. At `≤640px` the wordmark drops (logo stays) and the view
switch scrolls horizontally rather than overflow the bar. a11y: `aria-haspopup`/`-expanded`/`-controls`
+ label; axe finds no serious/critical violations. Verified by the new `tests/e2e/responsive.spec.js`
(desktop / phone / tablet).

**Phase 4 — The heavy views.** Split into three independently-shipped sub-phases:

- **4a — Home sidebar → phone drawer.** ✅ At `≤640px` the building-block palette becomes an off-canvas
  left drawer (`.workspace.palette-open`); the composer takes the full width, and a floating
  "Building blocks" trigger (`BlocksIcon`) opens it. Dismiss via the in-drawer ✕, the scrim, or Escape.
  Panel state is React (flipped on tap post-hydration); the drawer's existence is width-driven CSS, so
  first paint is SSR-safe. The full-height drawer restores the vertical palette layout (undoing the
  641–860 stack's row-wrapped tabs / capped chip area). `prefers-reduced-motion` disables the slide.
  a11y: `aria-controls`/`-expanded` on the trigger + a labelled close. Verified by `responsive.spec.js`
  (desktop inline / phone off-canvas → open → Escape → ✕) and the visual baselines (desktop unchanged).
- **4b — Single view.** ✅ At `≤860px` the image+metadata two-column grid (`.g-single-body`) collapses
  to one column; the image un-sticks (`position: static`) and caps at `60vh` so the details below stay
  reachable. CSS-only, width-driven — first paint unaffected, no feature change. Verified by
  `responsive.spec.js` (route-mocks `/api/feed` to populate the view: desktop 2-col vs phone 1-col +
  un-stuck). A sticky bottom action bar was considered and deferred as optional polish (the action row
  already wraps; not needed for mobile usability).
- **4c — Manage.** ✅ At `≤640px` the tree + editor become a master/detail: with no selection the tree
  fills the screen; selecting an entry/folder (React `selected` → `.workspace.manage.detail-open`) shows
  the editor with a phone-only "‹ Back to list" control. Desktop/tablet unchanged (both panes show; Back
  hidden). This phase also **scoped the Phase-4a Home drawer to `.workspace.home`** — the drawer's base
  `.sidebar` rule was matching Manage's `.mg-sidebar` too, which would have parked the Manage tree
  off-canvas with no opener; now Home-only. Verified by `responsive.spec.js` (mocks the `/api/manage/*`
  backend: phone master→detail→back, tree not a stray drawer; desktop both-panes).

Every capability preserved, only re-homed.

**Phase 5 — Touch & input ergonomics.** ✅ New `touch.css`, guarded by input-capability queries (not
width) so it never touches the mouse/desktop rendering. `@media (hover: none)` keeps the hover-revealed
action buttons visible (Manage entry delete/restore, per-image actions, list-row delete, theme delete) —
otherwise they're untappable on a touchscreen. `@media (pointer: coarse)` gives the primary controls a
≥44px tap target (WCAG 2.5.5). The palette FAB already uses `env(safe-area-inset-bottom)`. Verified by a
touch-emulated (`isMobile`) `responsive.spec.js` case (hover-only action `opacity:1`; `.vs-tab` ≥44px).

**Phase 6 — Verification.** A functional **viewport-matrix** spec (390 / 768 / 1280) already landed with
Phase 3 (`tests/e2e/responsive.spec.js`) and grows each phase; remaining: extend it to the Phase-4 view
layouts, consider a phone-width visual baseline, and re-confirm warning-free hydration at mobile widths.

---

## 7. Verification per phase

Standard gate (`npm test` = check:docs + lint + smoke + unit + web) plus, from Phase 6, the Playwright
viewport matrix (`npm run test:e2e`). Because views stay mounted, always confirm one view's responsive
CSS doesn't leak into another (scope every rule under its view/container). Legal/credits/data-practice
docs are unaffected (no data-flow change).
