# Responsive / Adaptive UI — Plan

**Status:** in progress. Phase 1 (fluid token foundation) landing on `feature/responsive-foundation`;
Phases 2–6 queued.
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

**Phase 2 — Adopt the `layout` layer.** Move `.app`, `main`/`.view-pane`, and Home's `.workspace` grid
into the `layout` cascade layer, rewritten fluid. Establish `container-type` contexts on the panes so
Phases 3–4 can use `@container`.

**Phase 3 — Top bar → responsive nav.** Desktop unchanged. Tablet: condense wordmark, group controls.
Phone: brand + condensed view switch, with the secondary control pile behind the single top overflow
menu (§5). New component CSS in `layout` + a small post-hydration open/close state.

**Phase 4 — The heavy views.** Home sidebar → drawer/bottom-sheet on phone; Single view's image+detail
two-column → stacked, action row → sticky bottom bar; Manage's tree+editor → master/detail push nav.
Every capability preserved, only re-homed.

**Phase 5 — Touch & input ergonomics.** 44px minimum targets, `@media (hover:hover)` guards so hover
affordances gain touch equivalents, momentum scroll containers, `env(safe-area-inset-*)` for notches.

**Phase 6 — Verification.** Extend the Playwright visual + `@axe-core` specs with a **viewport matrix**
(e.g. 390 / 768 / 1280) so responsiveness is regression-locked; re-confirm warning-free hydration at
mobile widths.

---

## 7. Verification per phase

Standard gate (`npm test` = check:docs + lint + smoke + unit + web) plus, from Phase 6, the Playwright
viewport matrix (`npm run test:e2e`). Because views stay mounted, always confirm one view's responsive
CSS doesn't leak into another (scope every rule under its view/container). Legal/credits/data-practice
docs are unaffected (no data-flow change).
