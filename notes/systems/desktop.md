# Desktop Packaging (Tauri shell + Node sidecar)

_How the pre-built **desktop edition** is assembled and how it runs. Added 2.43.0._

The desktop edition is **not a fork** of the app. It is a thin [Tauri](https://tauri.app) (Rust)
shell that runs the *exact same* local-edition SPA + Node `/api` backend the build-from-source and
`npm start` editions run. All prompt logic, generation, the gallery, Manage, and the providers stay
in the JS engine (`src/`) and the Node server (`targets/web/backend/`); the shell only launches them inside a
native window. Everything lives under **`targets/desktop/`**.

## The pieces

| File | Role |
|------|------|
| `targets/desktop/src/lib.rs` | The shell. Stages the payload to a writable working copy, launches the Node backend as a child process (the "sidecar"), waits for it to listen, then points the WebView at it. Kills the child on exit. |
| `targets/desktop/stage.mjs` | Build-time staging (`beforeBuildCommand`). Assembles the runnable app payload under `targets/desktop/app/` and copies the platform Node binary as the sidecar runtime. |
| `targets/desktop/tauri.conf.json` | Tauri config: bundles `app/**/*` as a resource, the `frontend/` splash as the initial page, and per-OS bundle targets. `version` is kept mirrored to the repo `VERSION`. |
| `targets/desktop/frontend/index.html` | A tiny branded splash shown while the Node backend boots (before the WebView navigates to it). |
| `targets/desktop/Cargo.toml` | Rust crate. Deps: `tauri`, `tauri-plugin-log`, `serde`/`serde_json`, `log`. No app logic. |

npm scripts (in `targets/web/package.json`): `stage` (run the stager), `desktop:build` (`npm run build` →
`tauri build`), `desktop:dev` (`npm run build` → `tauri dev`). The Tauri CLI is a gui devDependency
(`@tauri-apps/cli`).

## Why a Node sidecar (not a port to Rust)

The local edition is a static `targets/web/dist/` **plus** a running Node process (`serve.js` → `apiHandler.js`)
that reads the engine from `src/` and the content from `data/` (cwd-relative), and writes user data
(`output/`, `user-settings.json`, `results.json`) to the cwd. Re-implementing any of that in Rust would
duplicate the engine and guarantee drift. Instead the shell **bundles the platform's own `node` binary**
and runs the unmodified `serve.js` against the unmodified app tree. One backend implementation, now three
transports (Vite dev middleware, `npm start`, the desktop shell) — they cannot drift.

## Staging (`stage.mjs`)

Assembles `targets/desktop/app/`:

- `src/`, `data/` — the engine + content (copied from the repo root).
- `targets/web/dist/` — the built **local** edition SPA (`VITE_ONLINE` unset).
- `targets/web/backend/`, `targets/web/shared/`, and every top-level `targets/web/*.js` helper (e.g. `vite-api-helpers.js`,
  which `apiHandler.js` imports — this one is easy to miss).
- `node_modules/` — the production dependency **closure** (`lodash` + `compromise` and its transitive
  deps `efrt`, `grad-school`, `suffix-thumb`), copied directly from the installed `node_modules` (no
  `npm` subprocess — Node 24 blocks spawning `npm.cmd` via `execFileSync`).
- `runtime/node(.exe)` — a copy of `process.execPath`, so each per-OS CI runner bundles the matching
  Node binary.
- `package.json` (minimal `{ type: "module", dependencies }`) so the staged tree resolves as ESM.
- `VERSION` — the marker the shell compares on upgrade.

It also mirrors `VERSION` into `tauri.conf.json`'s `version` (idempotent — only writes on change), so
`VERSION` stays the single source of truth. **Keep the tracked `tauri.conf.json` version in sync with
`VERSION`** on a bump (alongside `package.json`), so a build never dirties the tree.

## Runtime (`lib.rs`)

On launch the shell:

1. Resolves the bundled payload — normally `resource_dir()/app`, falling back to `<exe_dir>/app` (the
   portable raw-exe layout).
2. Chooses a **writable working root** — beside the executable for a portable build (a `.portable`
   marker file next to the exe), or the per-user app-data dir for an installed build.
3. **Copies the payload to a working copy** when the bundled `VERSION` differs from the working copy's
   `.staged-version` (or on first run), refreshing code + content but **leaving the user's own files
   untouched** (`output/`, `user-settings.json`, `results.json`). This is why upgrades never wipe user
   data — the code lives in the copied files; only the user's data is external, and it is preserved.
4. Spawns `runtime/node serve.js` with the working copy as CWD (so cwd-relative `./data/…` paths
   resolve and writes land somewhere writable), on a **free port**, with `NO_OPEN=1` (Node never opens
   a browser — the WebView is the window). On Windows the child gets `CREATE_NO_WINDOW`.
5. Polls the port; once it listens, navigates the WebView from the splash to `http://127.0.0.1:<port>/`.
6. Kills the child on `RunEvent::Exit`.

If the backend ever fails to start, the window keeps the splash rather than showing a broken app — and
the source / `npm start` / online editions are unaffected, because the shell is a convenience layer over
them, not a replacement.

## Editions vs. what ships

`data 3.8 MB + src 0.2 MB + targets/web/dist 2.4 MB + deps` plus the Node binary make a payload of ~96 MB;
the resulting installers are correspondingly sized. Windows uses the built-in **WebView2**, macOS uses
**WKWebView**, Linux uses **WebKitGTK** (the only OS needing extra system packages, installed in CI).

Cross-OS installers can only be produced on their own OS, so the desktop artifacts are built by the
per-OS matrix in `release.yml` (see [`../reference/deployment.md`](../reference/deployment.md)) and
attached to the GitHub Release: Windows `.msi` / NSIS `.exe` + a portable `.zip`, macOS `.dmg`, Linux
`.AppImage` / `.deb`.

## Updates

As of 2.44.0 the desktop (and every local) edition does a **check-and-notify** update check on launch: a
dismissible banner appears when a newer GitHub release exists (Phase 1). The shell stamps
`RAP_EDITION=installer|portable` on the Node child so the backend's `/api/update` handler reports the
right download path; the full in-app auto-installer (the Tauri updater plugin) is **scaffolded but
dormant** behind the crate's `updater` feature + a signing keypair. See
[`../reference/desktop-updater.md`](../reference/desktop-updater.md) and
[`../plans/updates-upgrades.md`](../plans/updates-upgrades.md).
