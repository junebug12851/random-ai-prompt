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

// Everything — code (src, data, gui, tmp, docs output) and the living docs (notes/, assets/,
// README.md, the repo docs, jsdoc.config.json) — lives at the repo root, so `root` and `repoRoot`
// are the same directory. (`repoRoot` is kept as a separate name for the doc-tree path helpers
// below that read it explicitly.)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = root;
const notesDir = path.join(repoRoot, "notes");
const outDir = path.join(root, "tmp", "jsdoc-tutorials");

const REPO_DOCS = ["list-credits.md", "list-help.md"];

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
  const rel = path.relative(repoRoot, absFile).split(path.sep).join("/");
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
  const abs = path.join(repoRoot, f);
  if (fs.existsSync(abs)) linkMap.set(abs, fileId(abs));
}

// ---- Clean up tutorial-page markdown for rendering ----
// docdash already renders each tutorial's title as the page heading, so the body's
// own leading H1 is a duplicate — drop it. Also strip trailing heading-anchor
// syntax (`## Title {#some_id}`) that the markdown renderer would otherwise print
// literally; the `\S`-before guard means a heading that *is* only a DPL `{#token}`
// is left alone.
function tidyTutorialMarkdown(md) {
  md = md.replace(/^(#{1,6}[ \t]+.*\S)[ \t]*\{#[A-Za-z0-9_-]+\}[ \t]*$/gm, "$1");
  md = md.replace(/^\s*#[ \t]+.+\r?\n(\r?\n)?/, "");
  return md;
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
    write(id, tidyTutorialMarkdown(rewriteLinks(c, path.join(absDir, readme.name))));
  } else {
    title = absDir === notesDir ? "Project Notes" : humanize(path.basename(absDir));
    write(id, "Section index — see the pages nested under this entry.\n");
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
    write(fid, tidyTutorialMarkdown(rewriteLinks(c, abs)));
    children[fid] = { title: titleOf(c, humanize(e.name.replace(/\.md$/, ""))), children: {} };
  }
  return { id, node: { title, children } };
}

const tutorials = {};
const notesRoot = buildDir(notesDir);
tutorials[notesRoot.id] = notesRoot.node;

const repoChildren = {};
for (const f of REPO_DOCS) {
  const abs = path.join(repoRoot, f);
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
// jsdoc.config.json + README + assets + code all live at the repo root, so run JSDoc from there.
// Invoke the PINNED jsdoc binary directly (not `npx jsdoc`, which could fetch a different version).
const jsdocBin = path.join(root, "node_modules", "jsdoc", "jsdoc.js");
const docsIndex = path.join(repoRoot, "docs", "jsdoc", "index.html");
try {
  execSync(`node "${jsdocBin}" -c jsdoc.config.json`, { cwd: repoRoot, stdio: "inherit" });
} catch (e) {
  // JSDoc exits non-zero on RECOVERABLE type-expression parse errors — modern TS-style JSDoc types
  // (`import("react").Ref`, `() => string`, `Error & {…}`, deep generics) its catharsis parser
  // rejects — yet it still writes the full site. Tolerate that when the output landed; a missing
  // index.html is the only real failure. (The type warnings are cosmetic; tighten the types later.)
  if (!fs.existsSync(docsIndex)) throw e;
  console.warn("JSDoc emitted non-fatal type-expression warnings — site generated, continuing.");
}

// ---- Install the fairyfox docs-theme into the output ----
// The theme is authored from scratch (assets/docs-theme/fairyfox-docs.css) and
// REPLACES docdash's default styles/jsdoc.css — it is the single authoritative
// stylesheet driving docdash's DOM, not a set of overrides. The injected JS
// (brand / breadcrumb / footer back-links — the docs-site standard's two-way
// link requirement) is copied to the path docdash.scripts references. See
// notes/reference/documentation.md.
const themeSrc = path.join(repoRoot, "assets", "docs-theme");
const outRoot = path.join(repoRoot, "docs", "jsdoc");
// 1) the from-scratch theme replaces docdash's generated stylesheet
fs.copyFileSync(
  path.join(themeSrc, "fairyfox-docs.css"),
  path.join(outRoot, "styles", "jsdoc.css"),
);
// 2) the injected JS: the ES-module entry + its ./modules/ (the <script> tag is
//    rewritten to type="module" during post-processing below).
const jsDest = path.join(outRoot, "assets", "docs-theme");
fs.mkdirSync(jsDest, { recursive: true });
fs.copyFileSync(path.join(themeSrc, "fairyfox-docs.js"), path.join(jsDest, "fairyfox-docs.js"));
copyDir(path.join(themeSrc, "modules"), path.join(jsDest, "modules"));
// 3) the CSS partials that fairyfox-docs.css @imports (→ styles/theme/*.css)
copyDir(path.join(themeSrc, "theme"), path.join(outRoot, "styles", "theme"));
// 4) the project logo (footer brand / referenced by the theme)
fs.copyFileSync(path.join(repoRoot, "assets", "icons", "512.png"), path.join(jsDest, "logo.png"));
// 5) the SELF-HOSTED fonts (Fraunces/Inter/JetBrains) — no Google Fonts request.
const fontsSrc = path.join(themeSrc, "fonts");
const fontsDest = path.join(jsDest, "fonts");
fs.mkdirSync(fontsDest, { recursive: true });
for (const f of fs.readdirSync(fontsSrc))
  fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDest, f));
// 6) the hand-authored Download page.
fs.copyFileSync(path.join(themeSrc, "download.html"), path.join(outRoot, "download.html"));
console.log(
  "Installed fairyfox theme → styles/jsdoc.css + styles/theme/ + assets/docs-theme/{fairyfox-docs.js,modules/,logo.png,fonts/} + download.html.",
);

// ---- SEO / social + native-ESM: post-process every generated HTML page ----
// docdash emits a plain <script src=…fairyfox-docs.js>; make it type="module".
// Each page also gets crawler-visible <head> tags: description, canonical,
// Open Graph + Twitter cards, robots, and JSON-LD. A sitemap.xml + robots.txt
// round it out. (These are STATIC so social/search crawlers see them without JS.)
const SITE = "https://fairyfox.io";
const BASE = `${SITE}/random-ai-prompt/`;
const OG_IMAGE = `${BASE}screenshots/single-desktop.png`;
const htmlFiles = listHtml(outRoot);
for (const abs of htmlFiles) enrichHtml(abs);
writeSitemap(htmlFiles);
console.log(
  `SEO + ESM: post-processed ${htmlFiles.length} HTML pages (+ sitemap.xml, robots.txt).`,
);

console.log("Done → docs/jsdoc/index.html");

// ---- helpers (hoisted) ----
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function listHtml(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listHtml(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
function canonicalFor(abs) {
  const rel = path.relative(outRoot, abs).split(path.sep).join("/");
  return rel === "index.html" ? BASE : BASE + rel;
}
function htmlEscape(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function extractDescription(html, fallback) {
  const inMain = html.match(/id="main"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  let txt = (inMain && inMain[1]) || (html.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || fallback;
  txt = txt
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (txt.length > 155) txt = txt.slice(0, 152).replace(/\s+\S*$/, "") + "…";
  return txt || fallback;
}
function enrichHtml(abs) {
  let html = fs.readFileSync(abs, "utf8");
  // Early page-type class on <html>, inline in <head> so it runs BEFORE first
  // paint — no deferred-module flash. Fixes (a) docdash's sidebar flashing in on
  // non-API pages before `ff-no-sidebar` lands, and (b) enables hiding the index
  // page's docdash spillover (file doclets after the README) with no flash. The
  // logic mirrors modules/util.js (here/isApiPage) and is idempotent with run().
  if (!html.includes("ff-early-chrome")) {
    const early =
      "<script>/*ff-early-chrome*/(function(){try{" +
      'var p=location.pathname.split("/").pop()||"index.html";' +
      "var c=document.documentElement.classList;" +
      'var api=p!=="index.html"&&p!=="download.html"&&p.indexOf("tutorial-")!==0;' +
      'if(!api)c.add("ff-no-sidebar");' +
      'if(p==="index.html")c.add("ff-home");' +
      'if(p==="download.html")c.add("ff-download");' +
      "}catch(e){}})();</script>";
    html = html.replace(/<head\b([^>]*)>/i, (m) => `${m}\n${early}`);
  }
  // native ESM — only the theme entry becomes a module (not docdash's scripts).
  html = html.replace(
    /<script\b([^>]*)\bsrc="((?:\.\/)?assets\/docs-theme\/fairyfox-docs\.js)"([^>]*)>/i,
    (m, pre, src, post) =>
      `<script${/type=/.test(pre + post) ? "" : ' type="module"'}${pre} src="${src}"${post}>`,
  );
  // ensure <html lang="en">
  html = html.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="en"$1>');
  // docdash's drawer checkbox is icon-only — give it an accessible name (WCAG 4.1.2).
  html = html.replace(
    /<input\b((?:(?!aria-label)[^>])*?)\bid="nav-trigger"/i,
    '<input$1id="nav-trigger" aria-label="Toggle navigation menu"',
  );
  if (!html.includes("data-ff-seo")) {
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || "Random AI Prompt";
    const desc = extractDescription(html, title);
    const canonical = canonicalFor(abs);
    const isArticle = path.basename(abs).startsWith("tutorial-");
    const ld = {
      "@context": "https://schema.org",
      "@type": isArticle ? "TechArticle" : "WebPage",
      name: title,
      headline: title,
      description: desc,
      url: canonical,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "Random AI Prompt — documentation", url: BASE },
      publisher: { "@type": "Organization", name: "Fairy Fox", url: SITE },
    };
    const meta =
      [
        '<meta name="ff-seo" content="1" data-ff-seo>',
        /name="description"/i.test(html)
          ? ""
          : `<meta name="description" content="${htmlEscape(desc)}">`,
        '<meta name="robots" content="index,follow">',
        `<link rel="canonical" href="${canonical}">`,
        `<meta property="og:type" content="${isArticle ? "article" : "website"}">`,
        '<meta property="og:site_name" content="Fairy Fox">',
        `<meta property="og:title" content="${htmlEscape(title)}">`,
        `<meta property="og:description" content="${htmlEscape(desc)}">`,
        `<meta property="og:url" content="${canonical}">`,
        `<meta property="og:image" content="${OG_IMAGE}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${htmlEscape(title)}">`,
        `<meta name="twitter:description" content="${htmlEscape(desc)}">`,
        `<meta name="twitter:image" content="${OG_IMAGE}">`,
        `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
      ]
        .filter(Boolean)
        .join("\n") + "\n";
    html = html.replace(/<\/head>/i, meta + "</head>");
  }
  fs.writeFileSync(abs, html, "utf8");
}
function writeSitemap(files) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = files
    .map((abs) => `  <url><loc>${canonicalFor(abs)}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n");
  fs.writeFileSync(
    path.join(outRoot, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outRoot, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`,
    "utf8",
  );
}
