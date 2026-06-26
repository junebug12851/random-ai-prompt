/**
 * @file
 * Build the unified JSDoc doc-site.
 *
 * JSDoc is the project's single documentation generator: it produces the code API
 * (from the `@file` / per-function JSDoc comments) AND renders the whole `notes/`
 * tree (plus the repo docs) as navigable **tutorial** pages, with the docdash
 * template. This script is the wiring that turns the nested `notes/` folders into
 * JSDoc tutorials (a flat dir of pages + a `tutorials.json` hierarchy that mirrors
 * the old Doxygen `_nav.dox`), rewriting inter-note Markdown links so they resolve
 * to the generated tutorial pages. Run via `npm run docs`.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notesDir = path.join(root, "notes");
const outDir = path.join(root, "tmp", "jsdoc-tutorials");

const REPO_DOCS = ["list-credits.md", "list-help.md", "Upgrade-2-0.md"];

const humanize = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const titleOf = (md, fallback) => {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/\{#.*?\}/g, "").trim() : fallback;
};
const dirId = (absDir) =>
  (absDir === notesDir
    ? "notes"
    : "notes__" + path.relative(notesDir, absDir).split(path.sep).join("__")) + "__index";
const fileId = (absFile) => {
  const rel = path.relative(root, absFile).split(path.sep).join("/");
  return rel.replace(/\.md$/i, "").split("/").join("__");
};

// ---- Pass 1: map every source path (and dir / README) to its tutorial id ----
const linkMap = new Map(); // absolute path (no ext normalization) -> tutorial id
const sources = []; // { abs, id, isHub, title (later) }

function scan(absDir) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const readme = entries.find((e) => e.isFile() && e.name.toLowerCase() === "readme.md");
  const id = dirId(absDir);
  linkMap.set(absDir, id); // link to the directory
  if (readme) linkMap.set(path.join(absDir, readme.name), id); // link to its README
  sources.push({
    abs: absDir,
    id,
    isHub: true,
    readme: readme ? path.join(absDir, readme.name) : null,
  });
  for (const e of entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    scan(path.join(absDir, e.name));
  for (const e of entries.filter(
    (e) => e.isFile() && e.name.endsWith(".md") && !(readme && e.name === readme.name),
  ))
    linkMap.set(path.join(absDir, e.name), fileId(path.join(absDir, e.name)));
}
scan(notesDir);
for (const f of REPO_DOCS) {
  const abs = path.join(root, f);
  if (fs.existsSync(abs)) linkMap.set(abs, fileId(abs));
}

// ---- Rewrite inter-note Markdown links to tutorial-<id>.html ----
function rewriteLinks(md, srcAbs) {
  const baseDir = fs.statSync(srcAbs).isDirectory() ? srcAbs : path.dirname(srcAbs);
  return md.replace(/\]\(([^)]+)\)/g, (whole, target) => {
    if (/^(https?:|#|mailto:)/i.test(target)) return whole;
    const hashIdx = target.indexOf("#");
    const linkPath = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
    if (linkPath === "") return whole; // pure anchor
    const cleaned = linkPath.replace(/\/$/, "");
    const abs = path.resolve(baseDir, cleaned);
    const id = linkMap.get(abs) ?? linkMap.get(abs.replace(/[/\\]$/, ""));
    return id ? `](tutorial-${id}.html)` : whole;
  });
}

// ---- Pass 2: write tutorial files + build tutorials.json ----
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const write = (id, content) => fs.writeFileSync(path.join(outDir, `${id}.md`), content, "utf8");

function buildDir(absDir) {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const readme = entries.find((e) => e.isFile() && e.name.toLowerCase() === "readme.md");
  const id = dirId(absDir);
  let title;
  if (readme) {
    const c = fs.readFileSync(path.join(absDir, readme.name), "utf8");
    title = titleOf(c, humanize(path.basename(absDir)));
    write(id, rewriteLinks(c, path.join(absDir, readme.name)));
  } else {
    title = absDir === notesDir ? "Project Notes" : humanize(path.basename(absDir));
    write(id, `# ${title}\n\nSection index — see the pages nested under this entry.\n`);
  }
  const children = {};
  for (const e of entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const sub = buildDir(path.join(absDir, e.name));
    children[sub.id] = sub.node;
  }
  for (const e of entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !(readme && e.name === readme.name))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(absDir, e.name);
    const c = fs.readFileSync(abs, "utf8");
    const fid = fileId(abs);
    write(fid, rewriteLinks(c, abs));
    children[fid] = { title: titleOf(c, humanize(e.name.replace(/\.md$/, ""))), children: {} };
  }
  return { id, node: { title, children } };
}

const tutorials = {};
const notesRoot = buildDir(notesDir);
tutorials[notesRoot.id] = notesRoot.node;

const repoChildren = {};
for (const f of REPO_DOCS) {
  const abs = path.join(root, f);
  if (!fs.existsSync(abs)) continue;
  const c = fs.readFileSync(abs, "utf8");
  const fid = fileId(abs);
  write(fid, rewriteLinks(c, abs));
  repoChildren[fid] = { title: titleOf(c, humanize(f.replace(/\.md$/, ""))), children: {} };
}
write(
  "project-repo__index",
  "# Project & Repository\n\nRepository-level docs that aren't development notes.\n",
);
tutorials["project-repo__index"] = { title: "Project & Repository", children: repoChildren };

fs.writeFileSync(path.join(outDir, "tutorials.json"), JSON.stringify(tutorials, null, 2), "utf8");

// ---- Transpile the gui (React/JSX) so JSDoc can read it ----
// JSDoc's parser can't read JSX, so babel strips it (preserving comments) into a temp
// mirror that JSDoc reads instead of the .jsx source. The `@module` tags in each file
// give clean nav names, so the temp path doesn't matter. The plain .js lib files pass
// through unchanged. See jsdoc.config.json (`source.include` adds tmp/webapp-docs).
const webappOut = path.join(root, "tmp", "webapp-docs");
fs.rmSync(webappOut, { recursive: true, force: true });
function transpileTree(absDir, relBase) {
  if (!fs.existsSync(absDir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      n += transpileTree(abs, path.join(relBase, e.name));
      continue;
    }
    if (!/\.(jsx?|mjs)$/.test(e.name)) continue;
    const outAbs = path.join(webappOut, relBase, e.name.replace(/\.jsx$/, ".js"));
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    const res = transformSync(fs.readFileSync(abs, "utf8"), {
      filename: abs,
      presets: [["@babel/preset-react", { runtime: "automatic" }]],
      comments: true,
      compact: false,
      babelrc: false,
      configFile: false,
    });
    fs.writeFileSync(outAbs, res.code, "utf8");
    n++;
  }
  return n;
}
const waCount =
  transpileTree(path.join(root, "gui", "src"), "src") +
  transpileTree(path.join(root, "gui", "netlify"), "netlify");
console.log(`Transpiled ${waCount} gui files (JSX stripped) into tmp/webapp-docs for JSDoc.`);

console.log(`Wired ${linkMap.size} note pages into JSDoc tutorials. Running JSDoc (docdash)…`);
execSync("npx jsdoc -c jsdoc.config.json", { cwd: root, stdio: "inherit" });

// ---- Install the fairyfox docs-theme into the output ----
// The theme is authored from scratch (assets/docs-theme/fairyfox-docs.css) and
// REPLACES docdash's default styles/jsdoc.css — it is the single authoritative
// stylesheet driving docdash's DOM, not a set of overrides. The injected JS
// (brand / breadcrumb / footer back-links — the docs-site standard's two-way
// link requirement) is copied to the path docdash.scripts references. See
// notes/reference/documentation.md.
const themeSrc = path.join(root, "assets", "docs-theme");
const outRoot = path.join(root, "docs", "jsdoc");
// 1) the from-scratch theme replaces docdash's generated stylesheet
fs.copyFileSync(
  path.join(themeSrc, "fairyfox-docs.css"),
  path.join(outRoot, "styles", "jsdoc.css"),
);
// 2) the injected JS lands where jsdoc.config.json (docdash.scripts) links it
const jsDest = path.join(outRoot, "assets", "docs-theme");
fs.mkdirSync(jsDest, { recursive: true });
fs.copyFileSync(path.join(themeSrc, "fairyfox-docs.js"), path.join(jsDest, "fairyfox-docs.js"));
// 3) the project logo for the sidebar brand (referenced by fairyfox-docs.js)
fs.copyFileSync(path.join(root, "assets", "icons", "512.png"), path.join(jsDest, "logo.png"));
console.log(
  "Installed fairyfox theme → styles/jsdoc.css (replaced) + assets/docs-theme/{fairyfox-docs.js,logo.png}.",
);

console.log("Done → docs/jsdoc/index.html");
