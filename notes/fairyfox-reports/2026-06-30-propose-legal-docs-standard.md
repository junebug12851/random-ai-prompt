---
date: 2026-06-30
procedure: propose-standard (node → hub suggestion)
node: random-ai-prompt
outcome: proposal-only (hub NOT modified)
---

# Proposal to the fairyfox system — adopt a "Legal Docs" standard for all projects

> This is a **node-originated suggestion** for the hub to adopt, written here for the owner to carry
> upstream. Per the anti-recursion / stay-inside-this-repo rules, **nothing in the hub repo
> (`junebug12851.github.io`) was touched.** This file is the report; acting on it at the hub is the
> owner's separate, manual step.

## One-line ask

Promote what `random-ai-prompt` just did — self-hosted, code-accurate Privacy / Terms / Cookies pages,
kept current by default — into a shared `hub/standards/` standard so every project that ships a
user-facing surface does it the same way.

## Why (the trigger)

On 2026-06-30 the owner had TermsFeed-generated Privacy Policy, Terms & Conditions, and Cookies Policy
for this app. The free-tier drafts were generic and inaccurate: they described user accounts, marketing
emails, camera/photo-library access, login/auth cookies, and 24-month server logs — **none of which this
app has**. Rewriting them to match the code (no accounts, no analytics/cookies/tracking, local-only
storage, BYO keys sent directly to the chosen provider, a stateless proxy that logs nothing) produced
documents that are both more truthful and more defensible. That gap between boilerplate and reality is
not specific to this project — any fairyfox node that publishes a site/app will hit it. Hence a standard.

## Proposed standard (sketch — for the hub to refine)

Suggested name: `hub/standards/legal-docs.md`. Rough shape:

1. **Self-host, don't link out.** Legal pages live in-repo as static, on-brand pages served from the
   app's own origin (here: `gui/public/legal/{privacy,terms,cookies}.html`) — not as third-party
   generator links that can break, rebrand, or disappear.
2. **Accurate to the code, not boilerplate.** The policy must describe what the project *actually* does.
   Before writing/updating, read the source for: data collection, accounts/auth, analytics/telemetry,
   cookies vs. local storage, key handling, third-party network deps (fonts, CDNs, providers), and
   hosting/processors. Cut clauses that don't apply; add what's missing.
3. **A "keep accurate" standing responsibility.** Treat the docs as a living compliance surface (like
   credits/notes). A change to data practices updates the docs in the **same change**, with a bumped
   "Last updated" date. Project `CLAUDE.md` should carry the trigger list + a notes-table row (this repo
   now does — usable as the reference implementation).
4. **Accessibility/placement.** A clearly-labelled link in the app's primary menu satisfies GDPR/CCPA
   "easily accessible"; no law mandates footer placement specifically. Footer is optional.
5. **Sensible defaults baked in:** 18+ where adult content is possible; honest "we use no cookies" when
   true; name hosting providers as processors; flag any third-party IP exposure (e.g. Google Fonts) and
   prefer self-hosting fonts to remove it; a contact address on a project-owned domain, not a personal
   one.
6. **Disclaimer:** these are accuracy-and-hygiene guidance, not legal advice; recommend real review for
   high-stakes projects.

A `templates/legal/` set (the three HTML pages from this repo, parameterised) would let a node scaffold
compliant pages in one step. This repo's `engine-v3/gui/public/legal/*.html` can serve as the seed.

## Reference implementation (in this repo, this commit)

- `engine-v3/gui/public/legal/{privacy,terms,cookies}.html` — the pages.
- `engine-v3/gui/src/components/LinksMenu.jsx` — menu wiring (separator + three items).
- `CLAUDE.md` → "Keep the Legal Docs Accurate" section + notes-table row — the standing-responsibility pattern.

## Guardrails honored

On-request only; no hub pull/push; reference clone untouched; **no edit to any other repo**. This is a
report for the owner to take to the hub manually — the system does not reach back into this node, and
this node does not reach into the hub.
