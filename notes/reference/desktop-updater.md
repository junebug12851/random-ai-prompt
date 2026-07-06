# Desktop auto-updater — the scaffold + the owner's finishing steps

_Status: **Phase 1 shipped; Phase 2 scaffolded, dormant.** The check-and-notify banner is live for
every local/desktop edition. The full in-app auto-installer is wired but **off** — it activates only
after the owner generates a signing keypair and adds it to CI. Until then nothing about the desktop
build changes. See the design in [`../plans/updates-upgrades.md`](../plans/updates-upgrades.md)._

## What Phase 1 ships (check-and-notify — active now)

On launch, a local/desktop build asks its own backend (`GET /api/update`) whether a newer GitHub
release exists; if so, a dismissible banner offers the right update path for the detected edition.

| Piece | File |
|-------|------|
| Pure semver compare + client orchestration (throttle + per-version dismissal) | `gui/src/lib/updateCheck.js` |
| React hook | `gui/src/lib/useUpdateCheck.js` |
| The banner UI (edition-aware CTA) | `gui/src/components/UpdateBanner.jsx` + `gui/src/styles/components/update-banner.css` |
| Backend: latest-release fetch (server-side, 1 h cache) + edition detection | `gui/server/apiHandler.js` (`/api/update`) |
| Desktop edition stamp (`RAP_EDITION=installer\|portable`) | `gui/src-tauri/src/lib.rs` |

Edition detection (backend): `RAP_EDITION` env (set by the Tauri shell) wins; else a `.git` dir in the
cwd ⇒ `git`; else `source`. The **online** build never checks (it is always the latest deploy) and a
`dev` build never nags. The GitHub call is **server-side** (the local backend already contacts GitHub
for the Manage tab's restore manifest), so the browser opens no new connection — nothing to disclose
beyond what the desktop/local edition already does.

Per-version dismissal + a 12 h client throttle are stored through the app's normal storage layer (the
new `update` namespace — disk locally, `localStorage` online), so no new tracking surface is added.

## What Phase 2 scaffolds (full in-app auto-installer — dormant)

Everything needed to turn on the Tauri updater plugin is in the tree but gated so a normal build is
unaffected:

| Piece | File | Gated by |
|-------|------|----------|
| Optional Rust dependency + `updater` Cargo feature | `gui/src-tauri/Cargo.toml` | feature off by default → plugin not compiled |
| Plugin registration | `gui/src-tauri/src/lib.rs` (`#[cfg(feature = "updater")]`) | the `updater` feature |
| Updater config fragment (endpoints + `pubkey` placeholder + `createUpdaterArtifacts`) | `gui/src-tauri/tauri.updater.conf.json` | merged only via the `--config` flag |
| Build script that enables both | `gui/package.json` → `desktop:build:updater` | only invoked by the gated CI step |
| CI: key detection + updater build + `.sig` collection | `.github/workflows/release.yml` (`desktop` job) | `steps.updkey.outputs.has_key` (the `TAURI_SIGNING_PRIVATE_KEY` secret) |

With **no** `TAURI_SIGNING_PRIVATE_KEY` secret set, `has_key=false`: the plain `desktop:build` runs and
the release is byte-for-byte what it is today. The updater path is pure opt-in.

## Owner finishing steps (do these to turn Phase 2 on)

1. **Generate the updater keypair** (once), locally:
   `npm --prefix gui run tauri signer generate -- -w ~/.tauri/rap-updater.key`
   It prints a **public key** (base64) and writes the **private key** (+ you set a password).
2. **Put the public key in the config fragment.** Replace `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` in
   `gui/src-tauri/tauri.updater.conf.json` with the printed public key. (Public keys are safe to
   commit.)
3. **Add the private key to CI as repo secrets** (Settings → Secrets → Actions):
   `TAURI_SIGNING_PRIVATE_KEY` (the file's contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Once
   present, the next release automatically builds the updater variant and uploads the `.sig` files.
4. **Serve a `latest.json` manifest** at the endpoint the fragment points to
   (`…/releases/latest/download/latest.json`). It aggregates **all three OS** builds' version, notes,
   and per-target `signature` + download `url`. Because the release matrix builds each OS on its own
   runner, assemble it in a small follow-up job that waits for all three (or adopt
   `tauri-apps/tauri-action`, which composes `latest.json` for you). This is the one piece left as a
   deliberate placeholder — it needs all platforms' signatures in one place.
5. **Trigger the check/install.** This app's WebView points at the local Node server (an external
   `http://127.0.0.1` origin), so the Tauri **JS** updater API isn't injected there — drive the update
   from **Rust** instead: in `lib.rs`, under `#[cfg(feature = "updater")]`, call
   `app.updater()?.check()` on launch and, if an update is found, download + install + relaunch (with
   the "keep the previous working copy until the new one is proven" fallback from the design doc).
   Wire this when you enable the feature.

## Guardrails carried over from the design

- Never destructive to user data (the shell already keeps `output/`, `user-settings.json`,
  `results.json` outside the refreshed code copy).
- Verified artifacts only — the updater refuses an unsigned/mis-signed package (that's the whole point
  of the keypair).
- A failed update must never break the running app — always leave a working fallback.
- Nothing background-mutates without consent.

## Verify

- **Phase 1, headless:** `npm --prefix gui run test -- updateCheck` (the pure compare + orchestration
  unit tests), then `npm test` (lint + smoke + suites) and `npm --prefix gui run build` (the browser
  glob build — the SSR/prerender guard covers the banner rendering `null` server-side).
- **Phase 1, desktop:** a `desktop:dev` build shows the banner when `VERSION` is behind the latest
  release; portable vs installed report the right CTA via `RAP_EDITION`.
- **Phase 2:** a normal `npm --prefix gui run desktop:build` still builds with **no** updater plugin
  (feature off). Only `desktop:build:updater` (with a real pubkey + signing env) produces updater
  artifacts. Confirm `cargo build` without the feature doesn't pull `tauri-plugin-updater`.
