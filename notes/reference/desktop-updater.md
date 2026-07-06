# Desktop auto-updater — the scaffold + the owner's finishing steps

_Status: **Phase 1 shipped; Phase 2 implemented, activates on CI secret.** The check-and-notify banner
is live for every local/desktop edition. The full in-app auto-installer is now fully wired — signing
public key committed, the Rust check-on-launch → prompt → install trigger in place (compile-verified via
`cargo check --features updater`), and the `latest.json` manifest assembled by CI. It stays **inert**
until the owner adds the private signing key as a CI secret (`TAURI_SIGNING_PRIVATE_KEY`); with no
secret the release pipeline is byte-for-byte unchanged. The single remaining owner action is **step 3
below** (add the secrets). See the design in [`../plans/updates-upgrades.md`](../plans/updates-upgrades.md)._

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

## What's already done (in the tree)

1. ✅ **Keypair generated** — `%USERPROFILE%\.tauri\rap-updater.key` (private, off-repo) + `.pub`.
2. ✅ **Public key committed** — in `gui/src-tauri/tauri.updater.conf.json` (`pubkey`).
3. ✅ **Rust check-on-launch → prompt → install** — `spawn_update_check` in `lib.rs` under
   `#[cfg(feature = "updater")]` (the WebView is on an external `http://127.0.0.1` origin, so the update
   is Rust-driven, not JS): on launch it checks; if a signed newer release exists it shows a **native
   dialog** (`tauri-plugin-dialog`) and, on confirm, downloads + installs + relaunches. Compile-verified
   with `cargo check --features updater`.
4. ✅ **`latest.json` assembled by CI** — the `updater-manifest` job in `release.yml` aggregates each
   OS's `.sig` + the updater-artifact download URLs into `latest.json` and uploads it to the release, so
   the endpoint (`…/releases/latest/download/latest.json`) resolves. Key-gated (inert without the secret).

## The one remaining owner step (turns Phase 2 ON)

**Add the signing key as CI secrets** (Repo → Settings → Secrets and variables → Actions), or via
`gh secret set`:

- `TAURI_SIGNING_PRIVATE_KEY` — the **contents** of `%USERPROFILE%\.tauri\rap-updater.key`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password chosen at generation.

Once both exist, the **next release** automatically builds the updater variant, signs the artifacts,
and publishes `latest.json`. Nothing else to change. (Keep a copy of the private key + password in your
password manager — losing either means you can't sign future updates and auto-update breaks.)

### Validate on the first signed release

- Confirm the release has `latest.json` + the `.app.tar.gz`/`-setup.exe`/`.AppImage` updater artifacts
  and their `.sig` files.
- Install the previous version, then launch a build made from the new release: it should prompt and
  self-update. macOS auto-update covers only the runner's arch (aarch64); add an x86_64 mac matrix leg
  if Intel Macs must auto-update.

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
- **Phase 2 (done here):** `cargo check --features updater` compiles the trigger; `cargo check` (no
  feature) compiles clean and `cargo tree` shows **neither** `tauri-plugin-updater` nor
  `tauri-plugin-dialog` in the default graph — a normal `npm --prefix gui run desktop:build` is
  unaffected. Only `desktop:build:updater` (feature + config fragment + signing env) produces updater
  artifacts. The end-to-end self-update can only be fully validated from a real signed release (above).
