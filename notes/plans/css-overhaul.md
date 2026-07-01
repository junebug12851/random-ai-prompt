# CSS Overhaul, Modularization & Theming Framework — Plan

**Status:** proposal / awaiting go-ahead. No code changed yet — this is the blueprint.
**Scope:** `engine-v3/gui/src/styles.css` (the 4,515-line monolith) → a modern, modular,
layered, fully token-driven CSS system + a runtime theming framework (dark/light bases ×
neon accent presets).

> **Scope note (revised twice):** This plan ships **Rung 0 (System) + Rung 1 (Base × Accent
> presets) + Rung 3 (portable theme files: import/export a small JSON of token overrides)**.
> The only piece deferred is **Rung 2 (an in-app custom color *editor* GUI)** — deliberately
> skipped because the theme-file import (Rung 3) already provides customization for power users
> without building a color-picker cockpit. Adding the Rung 2 editor later is a pure addition (a UI
> that writes the same JSON the importer reads). Runtime lazy-loading of accents (former "Phase 6")
> is **in**.

---

## 1. Why we're doing this (goals & non-goals)

### Goals
1. **Kill the CodeFactor `F`.** `styles.css` has *zero* lint issues today — its `F` is driven
   purely by size (5,268 counted lines). Splitting into ~30 files, each well under ~300 lines,
   removes the size penalty. Target: every CSS file grades `A`, and the repo's overall grade
   rounds up (once the split lands on `main`, which is the branch CodeFactor grades).
2. **Modernize.** Adopt current-standard CSS: cascade layers, a two-tier design-token system,
   `color-mix()`/`oklch()` for derived colors, `@property` typed custom properties, logical
   properties, `:where()` zero-specificity resets, container queries where they beat media
   queries, and `prefers-reduced-motion`/`forced-colors` support.
3. **Modularize.** One monolith → a `styles/` tree organized by concern (tokens, base, layout,
   components, themes, utilities), assembled through a single `index.css`. Each of the ~60
   existing comment-delimited sections becomes (or joins) a file.
4. **A real theming framework.** Users pick a **base** (System / dark / light) and an **accent
   preset** (neon colors) from a header dropdown; power users can import a small theme-file. Light-
   mode accents read as pastel-neon; dark-mode accents as true neon. Fonts are **not** themeable
   (fixed to the current pairing) in this scope.
5. **Preserve behavior & accessibility.** Pixel-identical rendering through the refactor phases
   (guarded by the existing Playwright visual baseline), WCAG AA maintained per theme.
6. **Clean, non-hacky CSS.** Actively remove cruft as we go: dead/duplicate rules, magic numbers
   (fold into tokens/scales), gratuitous `!important`, over-specific selectors and specificity
   wars (cascade layers make most unnecessary), brittle workarounds, and copy-paste. The result
   should read as focused, well-named, intentional CSS — each rule earns its place. Load-bearing
   "hacks" that are actually required (e.g. the `-webkit-appearance` number-spinner reset) are
   **kept but documented** so they're not mistaken for cruft. Every cleanup is render-equivalent
   and proven so by the visual-regression diff — "clean" never means "changed the look."

### Non-goals (explicitly out of scope for this effort)
- No redesign of layouts or components — this is a **re-plumbing**, not a re-skin (new *themes*
  are additive; the default keeps today's charcoal + mint look).
- No CSS framework/Tailwind/Sass adoption — stay plain CSS (Vite already bundles `@import`).
- No change to what data leaves the device (theming is local-only; see §12).

---

## 2. Current-state audit (what we're starting from)

- **One file:** `gui/src/styles.css`, 4,515 lines, imported once in `main.jsx`
  (`import "./styles.css";`). ~60 sections, each already introduced by a `/* ---- name ---- */`
  banner — a natural seam map for the split.
- **Already token-driven — big head start.** `:root` defines the palette as custom properties
  (`--accent`, `--accent-strong`, `--accent-soft`, `--bg`, `--panel`, `--fg`, `--border`,
  `--radius*`, `--font-*`, plus a `--dpl-*` set for CodeMirror syntax). Components mostly consume
  these, so retheming is largely "remap the variables," not "rewrite the rules."
- **Dark-first with a light fallback.** A single `@media (prefers-color-scheme: light)` block
  overrides the surface/text/DPL tokens. There is **no runtime switch today** — the OS decides.
- **Tooling present:** `gui/stylelint.config.mjs` exists and the CSS lint gate is green
  (commit `c1482cc`, "clear all lint issues", 2.35.3). Build is Vite 8 + React; **no PostCSS,
  autoprefixer, or Sass** in the tree. Fonts are self-hosted via `@fontsource/*`.
- **Settings/persistence pattern to mirror:** settings flow through `gui/storage/` (a synchronous
  in-memory cache hydrated at boot; a real file on disk locally, `localStorage` only in the online
  build). There's already a `locale` preference (`"auto"` or a code) — a `theme`/`accent`
  preference follows the exact same shape.
- **i18n is the architectural template.** `gui/src/i18n/` (`config.js`, `I18nProvider.jsx`,
  `loadMessages.js`) + a language picker in `LinksMenu.jsx` is a working example of exactly the
  provider/registry/persisted-preference/menu-picker pattern the theme system needs.
- **Safety net exists:** `engine-v3/tests/e2e/visual.spec.js` (Playwright visual regression). This
  is the linchpin that lets us refactor 4,500 lines of CSS without fear.

**Implication:** the codebase is unusually well-positioned for this. The main work is (a) a
physical split, (b) upgrading the token layer from one-tier to two-tier, and (c) building the
theme-selection layer on top. The risk is mostly *regression*, which we neutralize with the
visual baseline.

---

## 3. Target architecture

### 3.1 Cascade layers (the specificity backbone)
Wrap everything in an explicit `@layer` order declared once, up front:

```css
@layer reset, tokens, base, layout, components, utilities, theme, overrides;
```

Why: layers make source order and file order irrelevant to precedence, so we can split freely
without specificity surprises, and a `theme` layer can cleanly override `components` without
`!important` or selector-weight games. This is the single most important modernization for
maintainability.

### 3.2 File tree (the modular split)
```
gui/src/styles/
  index.css                 # @layer decl + @imports, in order. This is what main.jsx imports.
  reset.css                 # box-sizing, margin reset, :where() normalizations
  tokens/
    primitives.css          # raw palette + scales: --green-500, --gray-900, radii, spacing, z, fonts
    semantic.css            # role tokens mapped from primitives: --accent, --bg, --fg, --border …
    dpl.css                 # --dpl-* syntax tokens (semantic, theme-aware)
  base/
    elements.css            # html/body/#root, typography defaults, focus-visible, scrollbars
    motion.css              # transitions + prefers-reduced-motion guards
  layout/
    app-frame.css           # .app, title bar, workspace two-pane, footer/status
    responsive.css          # container queries + remaining media queries
  components/
    buttons.css  inputs.css  cards.css  composer.css  dialogs.css
    links-menu.css  nsfw.css  block-palette.css  chips.css  tooltip.css
    settings.css  provider.css  prompt-result.css  gallery.css  manage.css
    code-editor.css  … (one file per existing section, ~25–30 files, each < ~300 lines)
  themes/
    _contract.css           # documents the token contract a theme must satisfy
    base-dark.css           # [data-theme="dark"]  → surfaces/text/lines
    base-light.css          # [data-theme="light"] → surfaces/text/lines (+ pastel accent mapping)
    accents/
      mint.css  aurora.css  magenta.css  cyan.css  amber.css  violet.css  …  (one per accent)
  utilities/
    helpers.css             # .flex, spacing helpers, a11y .visually-hidden, etc.
```
Vite inlines `@import`s at build, so this ships as one bundled stylesheet in production (no extra
HTTP requests) — modularity for authoring, single artifact for delivery. (Runtime *lazy* loading
of a selected theme is a separate, optional capability — see §3.6.)

### 3.3 Two-tier design tokens (the heart of theming)
Today's tokens are single-tier (semantic names holding literal hex). We split into:

- **Primitive tokens** (`tokens/primitives.css`): the raw material — a full palette expressed in
  **`oklch()`** (perceptually uniform, so accent ramps are even and contrast is predictable),
  plus radius/spacing/z-index/font scales. These never appear directly in component CSS.
- **Semantic tokens** (`tokens/semantic.css`): the roles components actually use — `--accent`,
  `--bg`, `--panel`, `--fg`, `--border`, `--ring`, etc. — each *mapped from* primitives.

**Themes only ever remap semantic tokens.** A base theme sets surfaces/text/lines; an accent sets
the accent ramp. Components stay untouched because they only ever read semantic tokens.

### 3.4 Derived colors via `color-mix()` / relative color (kills the shade sprawl)
Instead of hand-picking `--accent`, `--accent-strong`, `--accent-soft`, `--accent-hover`,
`--accent-ink` per theme, derive them from a single **accent seed**:

```css
--accent-strong: oklch(from var(--accent) calc(l - 0.06) c h);
--accent-soft:   color-mix(in oklch, var(--accent) 14%, transparent);
--accent-hover:  color-mix(in oklch, var(--accent) 88%, var(--fg));
```

An accent preset then becomes basically *one* line (`--accent: <seed>`), and light-vs-dark
behavior (pastel vs true-neon) is handled by mixing the seed toward the base's background/foreground.
This is what makes "many accents" cheap and consistent.

### 3.5 Theme application model (data attributes on `<html>`)
```
<html data-theme="dark" data-accent="aurora">
```
- `data-theme` ∈ {`dark`, `light`} selects a base (surfaces/text). `system` resolves to one of
  those at runtime via `matchMedia('(prefers-color-scheme: …)')`.
- `data-accent` selects an accent ramp.
- `color-scheme` is set to match so native form controls/scrollbars follow.
- Selectors: `[data-theme="light"] { … }`, `[data-accent="aurora"] { … }`, all inside `@layer theme`.

### 3.6 The "browser downloads and imports it" piece — runtime theme delivery
The modern mechanism you gestured at is **CSS module scripts / import attributes** —
`import sheet from "./themes/accents/aurora.css" with { type: "css" }` returns a ready
`CSSStyleSheet` that we attach via `document.adoptedStyleSheets`. This is the literal "the browser
downloads and imports a stylesheet as a module" capability. We use it to **lazy-load an accent
only when it's selected** (via dynamic `import(...)`), so the initial bundle stays lean and extra
accents cost nothing until chosen.

Note: with Rung 2/3 deferred there's **no runtime-generated custom sheet** — every theme is a
static, authored CSS file, so this is purely a *lazy-loading optimization*, not a correctness
requirement.

**Support & fallback:** `adoptedStyleSheets` and CSS module scripts are supported in current
Chrome/Edge/Firefox/Safari, but we gate on feature-detection and fall back to injecting a
`<link>`/`<style>` element. `oklch()`/`color-mix()` are broadly supported now; we set a
`.browserslistrc` and provide static hex fallbacks in the primitives layer for the default themes
so nothing breaks on an old engine. Because it's only an accelerator, this whole piece can also be
dropped to a plain "all accents in the bundle" approach if support/complexity ever argues for it.

---

## 4. The theming UX

### 4.1 The rungs we ship
- **Rung 0 — System.** Base follows the OS (`prefers-color-scheme`) and flips live when the OS
  flips — this is "the browser auto-selects dark/light." It's the current behavior, preserved.
- **Rung 1 — Base + Accent (the everyday UI).** A **System / Dark / Light** segmented control plus
  a **grid of accent swatches**. Click a swatch → the whole app recolors instantly. This is the
  entire experience for essentially everyone.
- **Rung 3 — Portable theme file (power users).** **Import** a small JSON of token overrides to go
  beyond the presets, and **Export** the current theme to get a starting file to edit/share. No
  in-app color-editor needed — the file *is* the customization surface. (See §4.4.)

**Deferred — Rung 2 (in-app custom color editor GUI).** Not built now. Customization is available
via the Rung 3 file. If we later want live sliders/color-pickers in the app, that editor just
writes the same JSON the importer already reads — a pure addition, no token/component rework.

### 4.2 The header control (your "combo box that drops a complex form")
A compact **Appearance** button sits on the right of the top bar — next to the existing links menu
and NSFW toggle (the bar already has `topbar-spacer → NsfwToggle → LinksMenu`; the theme button
joins that cluster). It shows a small swatch/paint icon reflecting the current accent. Clicking
opens a **popover form**:

```
┌ Appearance ─────────────────────────┐
│  Mode   [ System | Dark | Light ]   │   ← segmented control
│                                     │
│  Accent                             │
│   ● ● ● ● ●    (swatch grid)        │   ← click to apply live
│   ● ● ● ●                            │
│                                     │
│  ⋯ Import theme…   Export current    │   ← Rung 3, understated at the bottom
└─────────────────────────────────────┘
```
It's one popover: simple at a glance (mode + swatches), with the file actions tucked at the bottom
for the few who want them. Built as its own `components/ThemePicker.jsx`, opened from a header
button, following the same popover pattern the app already uses for the provider gear / links menu.

### 4.3 Accent presets (Material *common accent* hues as a color reference only)
Using Google Material's common **accent (A200/A400)** hues purely as a familiar reference palette —
**not** adopting Material Design itself. A curated, wheel-spanning set of ~9 that pairs with the
mint default:

| Name | Reference hue (Material A200) | Notes |
|------|------|-------|
| **Mint** *(default)* | ~`#69F0AE` / today's `#34e2a0` | current brand green |
| Teal | `#64FFDA` | |
| Cyan | `#18FFFF` | |
| Blue | `#448AFF` | |
| Violet | `#7C4DFF` (deep-purple A200) | |
| Magenta | `#E040FB` (purple A200) | |
| Pink | `#FF4081` | |
| Coral | `#FF6E40` (deep-orange A200) | warm red-orange |
| Amber | `#FFD740` | |

These reference hexes are **seeds**, not final values: each is retuned in `oklch()` for an even
ramp and re-mixed per base so it renders as **true neon on dark** and **pastel-neon on light**
(§3.4). Every seed must pass the AA contrast test (§8) before it ships; any that can't is nudged in
lightness/chroma until it does. Final count/names are open (§11).

### 4.4 Theme-file format (refining your "CSS variables in JSON, only overrides")
Your instinct is right; here's a churned/expanded version that stays small but is safe and
forward-compatible:

```jsonc
{
  "format": "rap-theme",          // identifies the file type
  "version": 1,                   // schema version → lets us evolve without breaking old files
  "name": "Midnight Pink",        // shown in the picker after import
  "base": "dark",                 // which base it builds on: "system" | "dark" | "light"
  "tokens": {                     // ONLY semantic-token overrides — usually just an accent
    "--accent": "#ff4081"
  }
}
```
- **Minimal by default.** A typical theme is `base` + one `--accent` line; everything else is
  derived (§3.4), so files stay short exactly as you wanted.
- **Only *semantic* tokens are allowed** (`--accent`, `--bg`, `--panel`, `--fg`, `--border`,
  `--radius`, …) — never primitives, never arbitrary CSS. On import each key is checked against an
  **allow-list** and each value **coerced/validated** as a color or length. Unknown keys and
  anything that isn't a clean color/length are rejected with a clear message. This is why the file
  can't be an injection vector (§10).
- **Applied at runtime** by generating a tiny `CSSStyleSheet` from the `tokens` map and attaching
  it via `document.adoptedStyleSheets` on top of the chosen base — the same adopted-sheet
  mechanism as §3.6.
- **Export** simply serializes the current base + accent (+ any active overrides) into this shape,
  giving users a valid starting file to tweak or share.

### 4.5 Default theme — recommendation
Ship the default as **base = System, accent = Mint.** This gives you both things you asked about:
it's mint (today's brand) *and* it auto-selects dark/light from the browser — which is also exactly
today's behavior, so nobody's experience changes on upgrade. (If you'd rather force **Dark + Mint**
regardless of OS, that's a one-line default change — say which and I'll set it. Flagged in §11.)

### Accent preset starter set (dark = true neon / light = pastel-neon)
Proposed initial palette (final names/colors are an open question — §11): **Mint** (default,
today's green), **Aurora** (green→cyan), **Cyan**, **Magenta/Hot-Pink**, **Violet**, **Amber**,
**Coral**. Each defined once as a seed; the base theme decides neon-vs-pastel rendering.

---

## 5. ThemeProvider (JS architecture — mirrors i18n)

```
gui/src/theme/
  config.js          # registry: bases, accents, defaults, allow-listed token contract, storage keys
  ThemeProvider.jsx  # context; reads settings; sets <html> data-* ; lazy-adopts accent/custom sheet
  useTheme.js        # { mode, accent, resolvedMode, setMode, setAccent, importTheme, exportTheme }
  applyTheme.js      # pure: (state) -> data-attrs (+ adopted sheet) side-effects
  presets.js         # accent seed definitions (data, not CSS) for the picker swatches
  themeFile.js       # Rung 3: serialize (export) + parse/validate (import) the theme JSON
```
UI: `gui/src/components/ThemePicker.jsx` — the header button + popover form of §4.2.

- **Persistence:** add `themeMode` (`system|dark|light`), `accent` (preset id), and `customTokens`
  (the last-imported override map, or null) to `defaultSettings` in `lib/settings.js`; they ride
  the existing storage cache (file locally, localStorage online). No new storage system.
- **No-FOUC boot script:** a tiny inline `<head>` script (in `index.html`) reads the persisted
  theme (or `prefers-color-scheme`) and sets `data-theme`/`data-accent` *before first paint*, so
  there's no flash of the wrong theme. This is the one piece that can't wait for React.
- **UI surface:** the `ThemePicker` header button + popover (§4.2), sitting in the top-bar's
  right cluster alongside `NsfwToggle` and `LinksMenu`. Mode + accent swatches up top; Import/Export
  understated at the bottom.

---

## 6. Modern-CSS checklist (applied throughout)
- `@layer` for all authored CSS.
- `oklch()` palette + `color-mix()`/relative-color derivation.
- `@property` typed registration for animatable tokens (smooth cross-theme transitions, gated by
  `prefers-reduced-motion`).
- **Logical properties** (`margin-inline`, `padding-block`, `inset`) — future-proofs RTL (the app
  is already i18n'd).
- `:where()` for zero-specificity resets/base.
- **Container queries** to replace layout media queries where a component should respond to its
  pane, not the viewport (the two-pane workspace is a prime candidate).
- `:focus-visible` focus rings from a `--ring` token; `forced-colors`/high-contrast handling;
  `prefers-reduced-motion` and (optionally) `prefers-contrast`.
- `color-scheme` kept in sync per theme.

---

## 7. Tooling & lint
- **Vite** bundles `@import` natively — no PostCSS needed for the split. Add **autoprefixer only if**
  the browserslist target warrants it (likely not; document the decision either way).
- **Stylelint:** extend `stylelint.config.mjs` — add `stylelint-order` (predictable property
  order), enforce **no raw hex outside `tokens/`** (a custom rule / `declaration-property-value`
  guard so components must use semantic tokens), and layer-/import-awareness. Keep the gate green
  in `npm test`.
- **`.browserslistrc`** added to pin the support target that justifies `oklch`/`color-mix`/adopted
  sheets and drives fallbacks.
- Keep everything inside `npm run lint` / `npm test` so CI stays the source of truth.

---

## 8. Testing strategy (regression is the real risk)
1. **Freeze a visual baseline first.** Run `tests/e2e/visual.spec.js` on `dev` HEAD and commit the
   baselines *before* touching CSS. Every subsequent phase must diff clean (or the diff must be an
   intended, reviewed change → `npm run test:e2e:update`).
2. **Token & split phases target zero visual change** — the visual suite is the pass/fail oracle.
3. **Theme-matrix visual tests:** parametrize screenshots over {dark,light} × {each accent} for a
   few representative screens (Generate, Manage, a dialog).
4. **axe a11y pass per theme** (extend the existing `@axe-core` specs) — contrast especially.
5. **Unit tests:**
   - `applyTheme` — state → correct `data-*` attributes; `system` resolves via a mocked
     `matchMedia` and *updates live* when the OS preference changes.
   - **Contrast test** — assert WCAG AA for **every shipped base×accent pair** (the guardrail that a
     new accent can't ship illegible) plus token-derivation sanity for the `color-mix`/`oklch`
     ramps.
   - `themeFile.js` (Rung 3) — export→import round-trips losslessly; import **accepts** a valid
     minimal file; import **rejects** unknown token keys, non-color/length values, wrong
     `format`/`version`, and any attempt to smuggle raw CSS — with a clear error each time.
   - Provider/`useTheme` — default, mode switch, accent switch, and persistence round-trip through
     the storage cache; **online-vs-local parity** (file-backed vs localStorage-backed).
6. `npm run smoke` + `npm test` green at every commit; `npm run test:e2e` before each release.

---

## 9. Phased delivery (each phase independently shippable & verifiable)

| Phase | Deliverable | Risk | Ships as |
|------|-------------|------|----------|
| **0. Guardrails** | Commit visual baseline; add `.browserslistrc`; stylelint rules; declare `@layer` order (no moves yet) | none | PATCH |
| **1. Token upgrade** | Two-tier tokens (primitives+semantic) + `color-mix` derivation; **zero visual change** | low | MINOR |
| **2. Physical split + cleanup** | Monolith → `styles/` tree under layers; **remove hacky CSS** (dead/duplicate rules, magic numbers, gratuitous `!important`, specificity hacks) while keeping render identical; `index.css` import | low–med | MINOR |
| **3. Theme engine** | ThemeProvider, `data-*` attrs, no-FOUC script; dark & light as real switchable themes (System still default) | med | MINOR |
| **4. Accent presets** | Neon accent set (seed-based); base×accent matrix | low | MINOR |
| **5. Picker UI (Rung 1)** | `ThemePicker` header button + popover: System/Dark/Light + accent swatches | low | MINOR |
| **6. Runtime delivery** | Lazy-load accents via CSS module scripts + adopted stylesheets (with `<link>` fallback) | med | MINOR |
| **7. Theme files (Rung 3)** | `themeFile.js` import/export + the popover's Import/Export actions | med | MINOR |

*(Deferred, not in this plan: Rung 2 — an in-app custom color *editor* GUI.)*

Phases 0–2 already fully retire the CodeFactor `F` (the split does it) — so the original ask is
satisfied early, and the theming (3–7) builds on a clean foundation. Rung-1 theming is complete at
Phase 5; Phases 6–7 add lazy loading and portable theme files. Each phase follows the repo's
default loop: `feature/*` branch → lint+format → smoke/tests → visual diff → commit with changelog
entry → merge `--no-ff` → release per SemVer. Ship whenever green with your go-ahead.

---

## 10. Risks & mitigations
- **Visual regression across 4,500 lines** → the Playwright visual baseline (Phase 0) is a hard
  gate; split in small, diff-clean commits.
- **Specificity breakage** → cascade layers make order-independence explicit; keep the same rule
  order within a layer during the split.
- **FOUC on load / theme change** → inline pre-paint boot script + adopted stylesheets.
- **Browser support** (`oklch`, `color-mix`, adopted sheets, CSS module scripts) →
  `.browserslistrc` + feature detection + hex fallbacks for default themes; runtime lazy-load
  degrades to `<link>` injection.
- **High-churn file** (`styles.css` shows churn 13) → land the split fast to stop new work piling
  into the monolith; communicate a freeze window.
- **Online vs local parity** → theme prefs use the existing storage layer that already abstracts
  file-vs-localStorage; test both editions.
- **Theme-file import as an attack surface** (Rung 3) → never inject arbitrary CSS text: parse to a
  known **allow-list** of semantic tokens, coerce each value as a color/length, reject everything
  else. Covered by the import rejection tests (§8).
- **Scope creep into redesign** → non-goals in §1 are the guardrail; default look is preserved.
  (Deferring the Rung 2 *editor* keeps the UI surface small — the theme file carries customization
  instead.)

---

## 11. Open questions for you

**Resolved from your notes:** Phase 6 (lazy accent loading) → **in**. Fonts → **not themeable**.
System/auto option → **yes**. Header dropdown (§4.2) → **yes**. Theme-file = JSON of semantic-token
overrides (§4.4) → **yes**. Accent palette → **Material A200 hues as reference** (§4.3).

**Still open:**
1. **Default base:** ship **System + Mint** (recommended — mint brand *and* auto dark/light, =
   today's behavior) or force **Dark + Mint**?
2. **Accent set:** the §4.3 nine (Mint, Teal, Cyan, Blue, Violet, Magenta, Pink, Coral, Amber) —
   good as-is, or add/drop/rename any?
3. **Rung 2 (in-app custom color editor):** confirmed *deferred* (customize via theme file for
   now) — agreed, or do you want the live editor in this pass too?

---

## 12. Housekeeping the refactor must carry (per repo standing instructions)
- **Notes:** session log entries per working day; a `decisions/architecture.md` entry for cascade
  layers + two-tier tokens + theming model; update `systems/gui.md`; new note pages auto-wire into
  the doc-site.
- **Legal:** theming is **local-only** — `themeMode`/`accent`/`customTokens` live in the existing
  on-device storage, fonts stay self-hosted, and the Rung 3 import reads a **user-picked local
  file** (no network fetch, no remote themes). No new third-party data flow, so the
  privacy/terms/cookies pages need **no change**; re-read them once at the theme-file phase to
  confirm and note "no change" in the session log.
- **Credits:** if we adopt any external palette/inspiration or tool, add it to `list-credits.md`.
- **Versioning:** bump `VERSION` + `package.json` together per phase (MINOR for feature phases,
  PATCH for Phase 0).

---

## 13. Bottom line
The repo is already ~70% of the way to themeable — it's variable-driven and cleanly sectioned. The
work is: **(a)** split the monolith under cascade layers (this alone fixes CodeFactor), **(b)**
upgrade one-tier tokens to a two-tier primitive→semantic system with `color-mix`/`oklch`
derivation, and **(c)** layer a header **Appearance** dropdown (System/Dark/Light × Material-
referenced accent swatches) plus a small **importable theme file** on top, modeled on the existing
i18n provider. Phases 0–2 retire the `F`; phases 3–7 deliver the theming, safely, behind a
visual-regression net. Only the in-app custom *editor* GUI (Rung 2) is deferred — and the theme-
file format is built so that editor, if ever wanted, is a pure addition that writes the same JSON
the importer already reads.
