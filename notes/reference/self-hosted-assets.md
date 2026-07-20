# Self-Hosted Assets

A published site makes **no third-party requests** for its own presentation. Fonts, icon fonts, and any
static asset the site controls are **self-hosted from its own origin** — never hot-linked from Google
Fonts, a public CDN, or similar, which leak the visitor's IP to that third party on every page load.

Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/self-hosted-assets.md`.
It directly supports the app's legal docs (see [below](#relationship-to-the-legal-docs)): a truthful
"no third-party requests" is both more private and easier to state than disclosing an IP leak.

## The rules

1. **Self-host the fonts.** Ship the font files from the site's own origin and reference them locally —
   no Google Fonts / Typekit / public font CDN hot-link.
2. **No third-party hot-links for controlled assets.** Icon fonts, CSS/JS the site owns, and other
   static assets are vendored and served from the site, not pulled from cdnjs/jsDelivr/unpkg at read
   time. (Genuinely external, user-invoked services — the image/text providers a user brings a key for
   — are a different thing; this rule is about the site's own chrome and presentation.)
3. **The published site makes no presentation request to a third party.** On load, a visitor's browser
   fetches the site's assets from the site; nothing about them (IP, request metadata) is sent to a font
   or CDN host for the page to render.
4. **Keep the legal pages honest with reality.** If an asset genuinely must come from a third party,
   **disclose the IP exposure** in Privacy/Cookies and record it as an exception with a remediation
   path — don't claim "no third-party requests" while hot-linking.

## Status in this project — compliant

This project already complies. As of 2.30.1 the web app's fonts were **self-hosted** from
`targets/web/public/fonts/` (sourced from the `@fontsource` packages), which **ended the former
IP-to-Google flow**; the doc-site fonts were self-hosted in the same era (no third-party call). This is
recorded in [`working-agreements.md`](working-agreements.md) §F and is the whole point of the
"Keep the Legal Docs Accurate" standing instruction in [`../../CLAUDE.md`](../../CLAUDE.md).

### Relationship to the legal docs

The three legal pages (`targets/web/public/legal/{privacy,terms,cookies}.html`) state that the chosen
AI provider + Netlify hosting logs are the only third-party data flows — a statement that is only true
**because** fonts are self-hosted. So this standard and the legal docs move together: **if a CDN font or
any other third-party presentation request is ever re-added, both this note's status and the legal pages
must be updated in the same change** (and the pages' "Last updated" date bumped).

## Verify (is it being followed?)

- Fonts are **self-hosted** — grep the built HTML/CSS for `fonts.googleapis.com` / `fonts.gstatic.com`;
  should be absent.
- No **third-party CDN hot-links** for the site's own assets (`cdnjs`, `jsdelivr`, `unpkg`) in the built
  output.
- The published site makes **no presentation request off-origin** — load it, watch the network panel,
  asset requests stay same-origin.
- Any real exception is **disclosed** in Privacy/Cookies with a remediation path.
