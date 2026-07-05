/**
 * Staging step for the Tauri desktop build (runs as Tauri's `beforeBuildCommand`).
 *
 * Tauri bundles a read-only payload as an app "resource"; at runtime the Rust shell
 * copies it to a writable working copy and runs the Node backend against it. This
 * script assembles that payload under `gui/src-tauri/app/`:
 *
 *   app/src            the isomorphic prompt engine
 *   app/data           the prompt content (lists, dynamic prompts, presets, sources)
 *   app/gui/dist       the built LOCAL edition SPA
 *   app/gui/server     the /api backend (serve.js + apiHandler.js + manageFs.js …)
 *   app/gui/providers  the provider adapters
 *   app/node_modules   production-only deps (lodash + compromise) resolved fresh
 *   app/runtime/node   the platform Node binary (the sidecar the shell launches)
 *   app/package.json   minimal { type:module, dependencies } so the staged tree is ESM
 *   app/VERSION        the version marker the shell compares on upgrade
 *
 * It also syncs the bundle version in `tauri.conf.json` from the repo-root `VERSION`,
 * keeping VERSION the single source of truth. It never touches the engine, the SPA,
 * or the server — it only copies their build output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // gui/src-tauri
const repoRoot = path.resolve(scriptDir, "..", "..");
const guiDir = path.join(repoRoot, "gui");
const stageDir = path.join(scriptDir, "app");
// Where to find installed packages when staging the production dep closure.
const nmRoots = [path.join(repoRoot, "node_modules"), path.join(guiDir, "node_modules")];

function must(p, hint) {
  if (!fs.existsSync(p)) {
    throw new Error(`stage: missing ${path.relative(repoRoot, p)} — ${hint}`);
  }
}

// The desktop app ships the full LOCAL edition, so the SPA must be built first
// (VITE_ONLINE unset). The npm `desktop:build` script does that before `tauri build`.
must(
  path.join(guiDir, "dist", "index.html"),
  "run the local SPA build first (npm run build in gui/, or use the desktop:build script)",
);

// Fresh staging dir.
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

/** Copy a directory tree into the staging area. */
function copyDir(from, to) {
  fs.cpSync(from, path.join(stageDir, to), { recursive: true });
}

copyDir(path.join(repoRoot, "src"), "src");
copyDir(path.join(repoRoot, "data"), "data");
copyDir(path.join(guiDir, "dist"), path.join("gui", "dist"));
copyDir(path.join(guiDir, "server"), path.join("gui", "server"));
copyDir(path.join(guiDir, "providers"), path.join("gui", "providers"));
if (fs.existsSync(path.join(guiDir, "user-settings"))) {
  copyDir(path.join(guiDir, "user-settings"), path.join("gui", "user-settings"));
}

// gui-root helper modules the server imports at runtime (e.g. vite-api-helpers.js,
// which apiHandler.js pulls in). Copy every top-level gui/*.js file — the runtime
// only loads the ones it imports; the dev-only configs just sit there unused.
for (const f of fs.readdirSync(guiDir)) {
  const full = path.join(guiDir, f);
  if (f.endsWith(".js") && fs.statSync(full).isFile()) {
    fs.copyFileSync(full, path.join(stageDir, "gui", f));
  }
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
