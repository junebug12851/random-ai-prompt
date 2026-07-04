# Regression-test backlog — retroactive audit of past fixes

Standing rule (2026-07-04): **every bug fix ships a regression test.** This doc backfills guards for
*past* fixes that predate that rule. Worked top-down by value; skip genuinely trivial one-off tweaks.

Scope: only the **current codebase** (post-2.0 ESM engine + SPA). The pre-revival capitalized
`Fixed …` commits belong to the **removed** CommonJS CLI/Express-Pug system (git history / read-only
reference only) — **out of scope**. `fix(ci|docs|lists|process|test|encoding|netlify)` commits are not
product-behavior bugs — **out of scope** (CI/docs/data-curation/build).

Homes: logic/engine → `tests/regression/bugRegressions.test.js`; SPA behavior/layout/stacking →
`tests/e2e/responsive.spec.js` (functional, hit-test) or a sibling e2e spec; component logic →
`gui/tests/`.

## Already covered (no action)

- Content-safety whole-word / NSFW whole-token / reserved `keyword` wildcard / list-stage leaves
  `{#name}` / NSFW gating / cleanup `AND,` → `bugRegressions.test.js` (7 tests).
- Mobile responsive rework (much of the 2.40.x batch): overflow menu collapse/cap, bottom sheets,
  palette drawer + tap-away scrim, single-view stacking + image-anchored overlay, touch targets ≥44px,
  tablet split panes → `tests/e2e/responsive.spec.js`.
- Composer settings-gear backdrop stacking (2.41.1) → `responsive.spec.js` (this session).
- **8eca885** engine auto-appended fx/artists re-resolve nested tokens → already guarded by
  `tests/integration/enginePipeline.test.js` ("resolves nested {#…} inside an auto-appended {#fx}").
  (Audit finding 2026-07-04 — the fix shipped its own test; no new guard needed.)

## Candidates — logic/engine (→ bugRegressions.test.js)

- [ ] **86c8e10** ProviderGear accordion showed image-gen settings under the Text/Upscale roles
  (`showSchema` logic: image, or upscale-only). Testable as a component/logic test (`gui/tests/`).
- [ ] **475d46d** image provider "Unset" is Plain text renamed (no separate no-provider state) — assert
  the provider registry/selection invariant.
- [ ] **854ac1a / 82d00c3** ComfyUI auto-resolve sampler+scheduler / checkpoint against `object_info`
  (+ readable local-server errors). Testable against a mocked `object_info`.
- [ ] **cb06fa7** proxy: unwrap ESM `default` adapters so Netlify functions don't 502. Assert the
  adapter-unwrap helper handles `{default: fn}` and bare `fn`.
- [ ] **2c17cc6** Manage backend probe must require JSON `ok:true` (not just HTTP 200).
- [ ] **221453a** force-prefix/group markers ignored in the SPA (Vite skips dotfiles) — loader parity;
  may only be assertable via the browser loader (note if not unit-testable).

## Candidates — gallery / gear UI (→ e2e)

- [ ] **e298922** gallery scrolls instead of clipping past the bottom.
- [ ] **1527d82** gallery width (`.prompts li` specificity) so images/placeholders flow; new roll
  appends (doesn't replace).
- [ ] **e8bde89** square thumbnail grid flows into columns.
- [ ] **81f43de** gear popover opens downward so it doesn't clip off the top.
- [ ] **42dfde4** full-width Reset button in the gear popover.
- [ ] **499b7fd** single-image overlay actions always visible (not hover-gated) — partially covered by
  the touch-ergonomics test; confirm/extend for the Single view specifically.

## Skip (with reason)

- All pre-2.0 `Fixed …` commits — removed legacy system (out of scope).
- `fix(ci|docs|lists|process|test|encoding|netlify|gui-commit-sweep)` — not product-behavior defects.
- Pure cosmetic/one-off tweaks with nothing behavioral to assert (judgment per item).

## Progress

- 2026-07-04: backlog created; 2.41.1 composer-gear guard landed. Audited `8eca885` → already covered
  (shipped its own integration test). Next: `86c8e10` ProviderGear role-schema (a component/logic test
  in `gui/tests/`).
