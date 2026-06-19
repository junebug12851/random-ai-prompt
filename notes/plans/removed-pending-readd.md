# Removed — Pending Re-add

Features intentionally pulled out of the SPA home screen during the 2026-06-19 UI
refinement pass, to be brought back later. Each was working when removed; the code
for most still lives in the tree (just unmounted) so re-adding is mostly re-wiring.

| Feature | Where it was | Status when removed | Re-add notes |
|---------|--------------|---------------------|--------------|
| **Image generation** | `Home.jsx` — "Generate images" button, provider line, in-session `Gallery` | Working (needs a provider key / local WebUI) | `Gallery.jsx`, `lib/providers/*` still present. Re-add the generate-images action + results gallery; depends on Settings (provider + keys) coming back too. |
| **Chaos knob** | `Home.jsx` controls row — numeric `chaos` input | Working; scaled emphasis/alternating via `withChaos` in `promptEngine.js` | `withChaos` still applied in the engine (no-ops at `chaos = 1`). Just re-add the control bound to `settings.chaos`. |
| **Presets** | `Home.jsx` — "Apply preset…" select + "Save preset" | Working (built-in + custom) | Owner wants this re-added as **something more complicated**: presets bundling full settings **plus auto-generation**, not the simple apply/save dropdown. `getPresetNames` / `loadPreset` / `saveCustomPreset` still exist. Design the richer version before re-wiring. |
| **Settings button + drawer** | `App.jsx` — "⚙ Settings" button → `SettingsDrawer` | Working | `SettingsDrawer.jsx` + `Settings.jsx` still present, just not imported/rendered. Re-add the trigger; likely returns alongside the richer presets + image generation. |
| **Local/online mode badge** | `App.jsx` topbar — green/blue "local"/"online" light | Working (`ONLINE` from `providers/index.js`) | Cosmetic. Re-add only if useful; consider folding into the footer instead of a top-bar light. |

Also changed in the same pass (not "removed", but noted): the centered hero
(logo → title → tagline) was dropped as cliché — the logo + wordmark now live only
in the slim top-bar; the made-up tagline is gone; the display font moved from
Rokkitt (read as Impact-like) to Space Grotesk; building blocks moved to a left
pane; and a rotating random-prompt **suggestion** (cycles every few seconds,
click to fill) was re-added to the composer.
