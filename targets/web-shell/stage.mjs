/**
 * Staging step for the Tauri desktop build (runs as Tauri's `beforeBuildCommand`).
 *
 * Tauri bundles a read-only payload as an app "resource"; at runtime the Rust shell
 * copies it to a writable working copy and runs the Node backend against it. The
 * payload MIRRORS the repo layout so the backend's relative imports (which reach the
 * engine via `../../../engine/…`, the shared providers via `../shared/…`, and the
 * user overlay via `../../../user/…`) resolve unchanged inside the working copy.
 * This script assembles that payload under `targets/web-shell/app/`:
 *
 *   app/engine                the isomorphic prompt engine + its content (engine/data)
 *   app/targets/web/dist      the built LOCAL edition SPA
 *   app/targets/web/backend   the /api backend (serve.js + apiHandler.js + manageFs.js …)
 *   app/targets/web/shared    the provider adapters
 *   app/user                  the seed user overlay (lists + blocks + README; settings NOT bundled)
 *   app/node_modules          production-only deps (lodash + compromise) resolved fresh
 *   app/runtime/node          the platform Node binary (the sidecar the shell launches)
 *   app/package.json          minimal { type:module, dependencies } so the staged tree is ESM
 *   app/VERSION               the version marker the shell compares on upgrade
 *
 * It also syncs the bundle version in `tauri.conf.json` from the repo-root `VERSION`,
 * keeping VERSION the single source of truth. It never touches the engine, the SPA,
 * or the server — it only copies their build output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // targets/web-shell
const repoRoot = path.resolve(scriptDir, "..", ".."); // targets/web-shell is two below the repo root
const webDir = path.join(repoRoot, "targets", "web"); // the web target (its dist/backend/shared)
const stageDir = path.join(scriptDir, "app");
// Where to find installed packages when staging the production dep closure.
const nmRoots = [path.join(repoRoot, "node_modules"), path.join(webDir, "node_modules")];

function must(p, hint) {
  if (!fs.existsSync(p)) {
    throw new Error(`stage: missing ${path.relative(repoRoot, p)} — ${hint}`);
  }
}

// The desktop app ships the full LOCAL edition, so the SPA must be built first
// (VITE_ONLINE unset). The npm `desktop:build` script does that before `tauri build`.
must(
  path.join(webDir, "dist", "index.html"),
  "run the local SPA build first (npm --prefix targets/web run build, or use the desktop:build script)",
);

// Fresh staging dir.
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

/** Copy a directory tree into the staging area (under a relative destination). */
function copyDir(from, to) {
  fs.cpSync(from, path.join(stageDir, to), { recursive: true });
}

// Engine (with its content: engine/data comes along), then the web target's build output. The
// destination paths mirror the repo so the backend's `../../../engine/…`, `../shared/…`, and
// `../../../user/…` imports resolve identically inside the working copy.
copyDir(path.join(repoRoot, "engine"), "engine");
copyDir(path.join(webDir, "dist"), path.join("targets", "web", "dist"));
copyDir(path.join(webDir, "backend"), path.join("targets", "web", "backend"));
copyDir(path.join(webDir, "shared"), path.join("targets", "web", "shared"));

// The user overlay's SEED content: the community-contributed lists/blocks + the user/ README. It's
// shipped so a fresh install already has it; the desktop shell seeds `user/` into the writable
// working copy ONCE (first run) and never clobbers it on upgrade, so the user's own additions AND
// their settings survive version changes. `user/settings/` is per-user RUNTIME data (the local
// store) — it is deliberately NOT bundled (that would ship the builder's own settings); the working
// copy creates it on demand.
copyDir(path.join(repoRoot, "user", "lists"), path.join("user", "lists"));
copyDir(path.join(repoRoot, "user", "blocks"), path.join("user", "blocks"));
const userReadme = path.join(repoRoot, "user", "README.md");
if (fs.existsSync(userReadme)) {
  fs.copyFileSync(userReadme, path.join(stageDir, "user", "README.md"));
}

// Version marker (the shell reads this to decide whether to refresh the working copy).
// VERSION carries comment (#) and blank lines; the version is the first real line.
const version = fs
  .readFileSync(path.join(repoRoot, "VERSION"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => l && !l.startsWith("#"));
if (!version) throw new Error("stage: could not parse a version from VERSION");
fs.writeFileSync(path.join(stageDir, "VERSION"), `${version}\n`);

// Minimal package.json for the staged tree: marks it ESM and pins the two runtime
// deps (no scripts, so `postinstall` etc. don't run in the sandbox; no devDeps).
const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const stagePkg = {
  name: "random-ai-prompt-runtime",
  private: true,
  version,
  type: "module",
  dependencies: {
    compromise: rootPkg.dependencies.compromise,
    lodash: rootPkg.dependencies.lodash,
  },
};
fs.writeFileSync(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(stagePkg, null, 2)}\n`,
);

// Copy the production dependency closure (lodash + compromise, both zero-dep) from
// the installed node_modules into the staged tree — offline and deterministic, with
// no npm subprocess. Walks each package's own dependencies so any transitive deps
// come along too.
console.log("stage: copying production deps (lodash + compromise)…");
{
  const nmDir = path.join(stageDir, "node_modules");
  fs.mkdirSync(nmDir, { recursive: true });
  const seen = new Set();
  const queue = Object.keys(stagePkg.dependencies);
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    let from = null;
    for (const root of nmRoots) {
      if (fs.existsSync(path.join(root, name, "package.json"))) {
        from = path.join(root, name);
        break;
      }
    }
    if (!from) {
      throw new Error(`stage: cannot find '${name}' in node_modules — run npm install at the repo root first`);
    }
    fs.cpSync(from, path.join(nmDir, name), { recursive: true });
    const pj = JSON.parse(fs.readFileSync(path.join(from, "package.json"), "utf8"));
    for (const dep of Object.keys(pj.dependencies || {})) queue.push(dep);
  }
}

// The Node runtime the shell launches as its sidecar: the platform's own node,
// so each per-OS CI runner bundles the matching binary. Named plainly; the shell
// looks for runtime/node(.exe).
const runtimeDir = path.join(stageDir, "runtime");
fs.mkdirSync(runtimeDir, { recursive: true });
const nodeName = process.platform === "win32" ? "node.exe" : "node";
fs.copyFileSync(process.execPath, path.join(runtimeDir, nodeName));
if (process.platform !== "win32") {
  fs.chmodSync(path.join(runtimeDir, nodeName), 0o755);
}

// Keep the Tauri bundle version in lockstep with the repo VERSION.
const confPath = path.join(scriptDir, "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
if (conf.version !== version) {
  conf.version = version;
  fs.writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
  console.log(`stage: synced tauri.conf.json version → ${version}`);
}

console.log(`stage: payload assembled at ${path.relative(repoRoot, stageDir)} (v${version})`);
