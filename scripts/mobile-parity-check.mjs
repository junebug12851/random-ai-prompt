/**
 * Mobile ⇄ web parity check. The mobile app copies several catalogs from the web (image providers,
 * accent presets, locales, DPL-insert constructs). This asserts those copies still match the web
 * SOURCES, so drift fails loudly — e.g. the web adds a provider / accent / DPL construct and this goes
 * red until the mobile port is updated. Engine/data parity is covered separately by
 * scripts/metro-parity-check.mjs; this covers the hand-ported UI catalogs.
 *
 * Run: `node scripts/mobile-parity-check.mjs` (from the repo root). Exits non-zero on any mismatch.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = join(ROOT, "targets/mobile");
const WEB = join(ROOT, "targets/web");
// Windows needs a file:// URL for dynamic import() of an absolute path.
const imp = (p) => import(pathToFileURL(p).href);

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  console.log(`  ✗ ${m}`);
  failures++;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- 1. Accent presets: mobile themeData.ACCENTS == web theme/themes/*.json ----------
async function checkAccents() {
  console.log("Accents (themeData.js  ⇄  theme/themes/*.json)");
  const { ACCENTS } = await imp(join(MOBILE, "lib/themeData.js"));
  const dir = join(WEB, "frontend/theme/themes");
  const web = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const webIds = web.map((a) => a.id);
  const mobIds = ACCENTS.map((a) => a.id);
  if (eq(webIds, mobIds)) pass(`ids match (${mobIds.length}): ${mobIds.join(", ")}`);
  else fail(`id/order mismatch — web [${webIds}] vs mobile [${mobIds}]`);
  for (const w of web) {
    const m = ACCENTS.find((a) => a.id === w.id);
    if (!m) {
      fail(`mobile missing accent "${w.id}"`);
      continue;
    }
    if (
      eq(
        { swatch: w.swatch, dark: w.dark, light: w.light },
        { swatch: m.swatch, dark: m.dark, light: m.light },
      )
    )
      pass(`"${w.id}" values match`);
    else fail(`"${w.id}" values differ from the web theme file`);
  }
}

// ---------- 2. Locales: mobile real locale (en) present in web i18n LOCALES ----------
async function checkLocales() {
  console.log("Locales (themeData.js  ⇄  i18n/config.js)");
  const { LOCALES } = await imp(join(MOBILE, "lib/themeData.js"));
  const cfg = readFileSync(join(WEB, "frontend/i18n/config.js"), "utf8");
  const block = cfg.slice(cfg.indexOf("LOCALES ="));
  const webCodes = [...block.matchAll(/^\s*"?([a-z]{2}(?:-[A-Z]{2})?)"?\s*:/gm)].map((m) => m[1]);
  for (const l of LOCALES.filter((x) => x.id !== "auto")) {
    if (webCodes.includes(l.id)) pass(`locale "${l.id}" is a registered web locale`);
    else fail(`locale "${l.id}" not found in the web i18n config`);
  }
}

// ---------- 3. DPL insert categories: mobile keys == web getDplInserts categories ----------
async function checkDplInserts() {
  console.log("DPL insert categories (dplInserts.js  ⇄  web dpl/dplInserts.js)");
  const { DPL_INSERTS } = await imp(join(MOBILE, "lib/dplInserts.js"));
  const src = readFileSync(join(WEB, "frontend/lib/dpl/dplInserts.js"), "utf8");
  const webKeys = [...src.matchAll(/key:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  const mobKeys = DPL_INSERTS.map((c) => c.key);
  if (eq(webKeys, mobKeys)) pass(`categories match (${mobKeys.length}): ${mobKeys.join(", ")}`);
  else fail(`category mismatch — web [${webKeys}] vs mobile [${mobKeys}]`);
}

// ---------- 4. Provider ROLE completeness: mobile MUST cover every provider the phone can run --------
// The phone has no backend of ours, so a web provider is "mobile-capable" iff it talks straight to its
// API from the client (browser-direct), hits the user's own server (local-direct), or needs no network
// at all (transport "none" — copy-prompt). The web exposes THREE provider roles (image generation /
// text prompt-rewrite / upscale). For each role, mobile MUST expose the same mobile-capable set — a
// missing one is a FAILURE, not a note. This is the completeness gate: it proves nothing runnable was
// dropped, instead of only checking that what was ported happens to match.
async function checkProviders() {
  console.log("Provider role completeness (mobile registries  ⇄  web shared/*/config.js)");
  const mod = await imp(join(MOBILE, "lib/imageProviders.js"));
  const mobImage = new Set((mod.IMAGE_PROVIDERS || []).map((p) => p.id));
  const mobText = new Set((mod.TEXT_PROVIDERS || []).map((p) => p.id));
  const mobUpscale = new Set((mod.UPSCALE_PROVIDERS || []).map((p) => p.id));

  const shared = join(WEB, "shared");
  const web = [];
  for (const d of readdirSync(shared, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    let cfg;
    try {
      cfg = readFileSync(join(shared, d.name, "config.js"), "utf8");
    } catch {
      continue;
    }
    const id = cfg.match(/id:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    const transport = cfg.match(/transport:\s*"([^"]+)"/)?.[1];
    const tier = cfg.match(/tier:\s*"([^"]+)"/)?.[1];
    const capBlock = cfg.slice(cfg.indexOf("capabilities"));
    web.push({
      id,
      transport,
      tier,
      textOnly: /textOnly:\s*true/.test(cfg),
      upscaleOnly: /upscaleOnly:\s*true/.test(cfg),
      hasGenerate: /loadGenerate/.test(cfg),
      hasRewrite: /loadRewrite/.test(cfg) || /\brewrite:\s*true/.test(cfg),
      hasUpscale: /loadUpscale/.test(cfg) && /upscale:\s*true/.test(capBlock),
    });
  }
  // EVERY web provider must be present per role — hosted-proxy ones run via a Backend URL, so nothing
  // is left out (mirrors the web's picker filters in ProvidersMenu.jsx, minus the online/local gating).
  const expImage = web.filter(
    (p) =>
      !p.textOnly && !p.upscaleOnly && (p.hasGenerate || p.tier === "syntax" || p.tier === "plain"),
  );
  const expText = web.filter((p) => p.hasRewrite);
  const expUpscale = web.filter((p) => p.hasUpscale);

  const role = (name, expected, have) => {
    const exp = expected.map((p) => p.id).sort();
    const missing = exp.filter((id) => !have.has(id));
    const extra = [...have].filter((id) => !exp.includes(id));
    if (!missing.length && !extra.length)
      pass(`${name}: all ${exp.length} mobile-capable providers present (${exp.join(", ")})`);
    if (missing.length)
      fail(`${name}: MISSING ${missing.length} mobile-capable provider(s): ${missing.join(", ")}`);
    if (extra.length)
      fail(
        `${name}: mobile lists provider(s) with no mobile-capable ${name} role on the web: ${extra.join(", ")}`,
      );
  };
  role("Image", expImage, mobImage);
  role("Text/rewrite", expText, mobText);
  role("Upscale", expUpscale, mobUpscale);
  const proxied = web.filter((p) => p.transport === "hosted-proxy").length;
  console.log(`  ℹ ${proxied} hosted-proxy providers included via the Backend URL setting`);
}

// ---------- 6. Surface feature parity: Generate / Gallery / Header must match the web features ------
// A mandatory gate: for each of the three focus surfaces, assert the mobile implementation carries a
// marker for every web feature. A missing marker fails loudly so a dropped/omitted feature can't hide.
function checkSurfaces() {
  console.log("Surface feature parity (Header / Generate / Gallery / Single / Manage)");
  const read = (rel) => {
    try {
      return readFileSync(join(MOBILE, rel), "utf8");
    } catch {
      return "";
    }
  };
  const files = {
    app: read("App.js"),
    overflow: read("components/OverflowMenu.js"),
    generate: read("screens/GenerateScreen.js"),
    gallery: read("screens/GalleryScreen.js"),
    single: read("screens/SingleScreen.js"),
    manageScreen: read("screens/ManageScreen.js"),
    manageBlock: read("components/ManageBlockEditor.js"),
    manageList: read("screens/ManageScreen.js"),
    builtin: read("components/BuiltinBrowser.js"),
  };
  // [surface, feature, fileKey, /marker/]
  const CHECKS = [
    // Header (topbar + overflow)
    ["Header", "logo", "app", /logo\.png/],
    [
      "Header",
      "tab switch (Generate/Gallery/Single/Manage)",
      "app",
      /Generate[\s\S]*Gallery[\s\S]*Manage/,
    ],
    ["Header", "overflow menu", "app", /OverflowMenu/],
    ["Header", "Image role picker", "overflow", /"img"/],
    ["Header", "Text role picker", "overflow", /"text"/],
    ["Header", "Upscale role picker", "overflow", /"up"/],
    ["Header", "grouped Local/Online", "overflow", /groupHead\("Local"\)/],
    ["Header", "Backend URL field", "overflow", /backendField/],
    ["Header", "Provider settings", "overflow", /Provider settings/],
    ["Header", "Appearance (theme+accent)", "overflow", /Appearance/],
    ["Header", "Language", "overflow", /Language/],
    ["Header", "version + legal links", "overflow", /APP_VERSION[\s\S]*Privacy Policy/],
    // Generate
    ["Generate", "DPL insert menu", "generate", /InsertMenu/],
    ["Generate", "DPL editor", "generate", /codeInput/],
    ["Generate", "live validity status", "generate", /valid\b/],
    ["Generate", "live preview", "generate", /previewOn/],
    ["Generate", "prompt-settings gear (full)", "generate", /Salt & lists/],
    ["Generate", "prompts-per-run", "generate", /promptCount/],
    ["Generate", "auto-fix (wand)", "generate", /autoFix/],
    ["Generate", "keyword-translate (tag)", "generate", /autoKeyword/],
    ["Generate", "building-block palette", "generate", /BlockPalette/],
    ["Generate", "completion strip", "generate", /suggestions/],
    ["Generate", "generate button", "generate", /SparkleIcon/],
    ["Generate", "negative prompt tab", "generate", /composeMode|Negative/],
    ["Generate", "wrapper button", "generate", /[Ww]rapper/],
    ["Generate", "share link", "generate", /shareUrl|Share link/],
    ["Generate", "random suggestion", "generate", /suggestion/],
    ["Generate", "inline per-prompt image batches", "generate", /batch|InlineImage/],
    // Gallery
    ["Gallery", "title", "gallery", /Photo gallery/],
    ["Gallery", "live count", "gallery", /images?`|count/],
    ["Gallery", "search", "gallery", /[Ss]earch/],
    ["Gallery", "multi-select", "gallery", /[Ss]elect/],
    ["Gallery", "refresh", "gallery", /[Rr]efresh/],
    ["Gallery", "bulk delete", "gallery", /deleteImages|Delete/],
    ["Gallery", "memoized cell (100k perf)", "gallery", /memo\(/],
    ["Gallery", "compact composer atop gallery", "gallery", /Composer|composer/],
    ["Gallery", "pending placeholder cells", "gallery", /pending|placeholder/],
    // Single (full parity with web SingleView.jsx) — every meaningful web feature mapped to mobile.
    ["Single", "back navigation", "single", /onBack/],
    ["Single", "prev/next navigation", "single", /hasPrev/],
    ["Single", "position (i / N)", "single", /index \+ 1/],
    ["Single", "open-full viewer", "single", /viewerOpen/],
    ["Single", "share (reveal equivalent)", "single", /Sharing/],
    ["Single", "save to Photos (download)", "single", /saveToPhotos/],
    ["Single", "delete", "single", /deleteImage/],
    ["Single", "convert format", "single", /doConvert/],
    ["Single", "resize scales", "single", /RESIZE_SCALES/],
    ["Single", "AI upscale", "single", /doUpscale/],
    ["Single", "lineage parent link", "single", /Parent/],
    ["Single", "derived-children strips", "single", /DerivedStrip/],
    ["Single", "in-flight derivation placeholders", "single", /derivations/],
    ["Single", "prompt layers (sent/ai/roll/dpl)", "single", /DPL source/],
    ["Single", "negative prompt layers", "single", /Negative/],
    ["Single", "inline re-roll / make-variation", "single", /runDerive/],
    ["Single", "curated details table", "single", /buildDetails/],
    ["Single", "raw JSON toggle", "single", /rawView/],
    ["Single", "all-settings expandable", "single", /restSettings/],
    ["Single", "copy Markdown", "single", /Copy Markdown/],
    ["Single", "copy JSON", "single", /Copy JSON/],
    ["Single", "keyword cloud", "single", /parseKeywords/],
    ["Single", "keyword rebuild (AI)", "single", /rebuildKeywords/],
    ["Single", "keyword search", "single", /onSearch/],
    // Manage — full content manager parity (to the platform-allowed extent: the on-device user overlay
    // + read-only built-in browse/override; no fs backend). Every web Manage capability maps to a marker.
    ["Manage", "two roots (Blocks + Lists)", "manageScreen", /readUserTree\("blocks"\)[\s\S]*readUserTree\("lists"\)/],
    ["Manage", "nested folder tree", "manageScreen", /ManageTree/],
    ["Manage", "new block / list create", "manageScreen", /createBlock[\s\S]*createList|createList[\s\S]*createBlock/],
    ["Manage", "folder create (nested name) + delete", "manageScreen", /deleteUserFolder/],
    ["Manage", "built-in browse + override", "manageScreen", /BuiltinBrowser/],
    ["Manage", "override copies to overlay", "builtin", /onOverride/],
    ["Manage", "runtime overlay wiring", "manageScreen", /refreshOverlay/],
    // Block (generator) editor
    ["Manage", "block DPL editor", "manageBlock", /DplMiniEditor/],
    ["Manage", "block Insert menu", "manageBlock", /InsertMenu/],
    ["Manage", "block Refine steppers", "manageBlock", /REFINE_DIMS/],
    ["Manage", "block Modify / Draft", "manageBlock", /dpl-custom[\s\S]*dpl-create|dpl-create[\s\S]*dpl-custom/],
    ["Manage", "block Cleanup", "manageBlock", /dpl-tighten/],
    ["Manage", "block JS sidecar", "manageBlock", /JS sidecar|createJs/],
    ["Manage", "block NSFW flag", "manageBlock", /nsfw/],
    ["Manage", "block description", "manageBlock", /description/],
    ["Manage", "block rename", "manageBlock", /rename/],
    ["Manage", "block delete", "manageBlock", /deleteUserBlock/],
    // List editor
    ["Manage", "list Entries/Raw tabs", "manageList", /switchMode|rawText/],
    ["Manage", "list Sort", "manageList", /sortLines/],
    ["Manage", "list Dedupe", "manageList", /dedupeLines/],
    ["Manage", "list AI Expand", "manageList", /aiExpand/],
    ["Manage", "list description", "manageList", /writeUserSidecar\("lists"/],
  ];
  const bySurface = {};
  for (const [surface, feature, fileKey, re] of CHECKS) {
    bySurface[surface] = bySurface[surface] || { ok: 0, miss: [] };
    if (re.test(files[fileKey] || "")) bySurface[surface].ok++;
    else bySurface[surface].miss.push(feature);
  }
  for (const [surface, r] of Object.entries(bySurface)) {
    if (!r.miss.length) pass(`${surface}: all ${r.ok} features present`);
    else fail(`${surface}: ${r.ok} present, MISSING ${r.miss.length}: ${r.miss.join(", ")}`);
  }
}

// ---------- 5. Local provider settings: mobile field keys == web provider settings.js field keys ----
async function checkLocalSettings() {
  console.log("Local provider settings (imageProviders.js  ⇄  web shared/*/settings.js)");
  const { IMAGE_PROVIDERS } = await imp(join(MOBILE, "lib/imageProviders.js"));
  // Which web settings.js each mobile local provider mirrors (forge/sdnext reuse local-webui).
  const SRC = {
    comfyui: "comfyui/settings.js",
    forge: "local-webui/settings.js",
    sdnext: "local-webui/settings.js",
  };
  for (const p of IMAGE_PROVIDERS.filter((x) => x.local)) {
    const rel = SRC[p.id];
    if (!rel) {
      fail(`no known web settings.js mapped for local provider "${p.id}"`);
      continue;
    }
    const src = readFileSync(join(WEB, "shared", rel), "utf8");
    const block = src.slice(src.indexOf("fields:"), src.indexOf("data:") + 1 || undefined);
    const webKeys = [...block.matchAll(/key:\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
    const mobKeys = (p.settings || []).map((f) => f.key);
    if (eq(webKeys, mobKeys)) pass(`"${p.id}" settings fields match (${mobKeys.length})`);
    else fail(`"${p.id}" settings fields differ — web [${webKeys}] vs mobile [${mobKeys}]`);
    // The URL field must default to the 192.168.1.1 hint the user asked for.
    const urlField = (p.settings || []).find((f) => f.key === p.serverKey);
    if (urlField && /192\.168\.1\.1/.test(String(urlField.default)))
      pass(`"${p.id}" Server URL defaults to the 192.168.1.1 hint`);
    else fail(`"${p.id}" Server URL should default to 192.168.1.1 (got "${urlField?.default}")`);
  }
}

// ---------- 7. List-editor ops: mobile lib/listOps.js == web lib/manage/listEditorOps.js ----------
// The Manage list editor's Sort / Dedupe / AI-expand logic is a hand-port on mobile; assert it stays
// behaviorally identical to the web source (same functions, same output) so it can't silently drift.
async function checkListOps() {
  console.log("List-editor ops (listOps.js  ⇄  web listEditorOps.js)");
  const mob = await imp(join(MOBILE, "lib/listOps.js"));
  const web = await imp(join(WEB, "frontend/lib/manage/listEditorOps.js"));
  const cases = [
    ["parseAiCandidates", ["- red\n2. green\n• blue"]],
    ["parseAiCandidates", ["red, green, blue"]],
    [
      "mergeNew",
      [
        ["Red", "green"],
        ["red", "BLUE", "blue", "Green"],
      ],
    ],
    ["dedupeLines", [["a", "A", "b", " a ", "b"]]],
    ["sortLines", [["banana", "Apple", "cherry"]]],
  ];
  for (const fn of ["parseAiCandidates", "mergeNew", "dedupeLines", "sortLines"]) {
    if (typeof mob[fn] !== "function") fail(`mobile listOps is missing "${fn}"`);
  }
  let ok = 0;
  for (const [fn, args] of cases) {
    if (typeof mob[fn] !== "function" || typeof web[fn] !== "function") continue;
    if (eq(mob[fn](...args), web[fn](...args))) ok++;
    else fail(`"${fn}" output differs from the web source for args ${JSON.stringify(args)}`);
  }
  if (ok === cases.length) pass(`all ${ok} list-op cases match the web source`);
}

// ---------- 8. Rewrite systems: mobile systemFor == web systemFor for EVERY mode --------------------
// The Manage AI features (list AI-Expand, block Refine/Modify/Draft) depend on the exact system prompts.
// Mobile hand-ports DPL_PRIMER + DPL_TASKS + EXPAND_SYSTEM; assert systemFor() is byte-identical to the
// web source for every mode so a web prompt tweak fails loudly until the mobile port is updated.
async function checkRewriteSystems() {
  console.log("Rewrite systems (imageProviders.systemFor  ⇄  web rewriteSystem.systemFor)");
  const mob = await imp(join(MOBILE, "lib/imageProviders.js"));
  const web = await imp(join(WEB, "shared/_shared/rewriteSystem.js"));
  const modes = [
    "keyword",
    "expand",
    "fix",
    undefined,
    "dpl-detail-more",
    "dpl-detail-less",
    "dpl-complex-more",
    "dpl-complex-less",
    "dpl-focus-more",
    "dpl-focus-less",
    "dpl-intensity-more",
    "dpl-intensity-less",
    "dpl-variety-more",
    "dpl-variety-less",
    "dpl-tighten",
    "dpl-custom",
    "dpl-create",
  ];
  let ok = 0;
  for (const m of modes) {
    if (mob.systemFor(m) === web.systemFor(m)) ok++;
    else fail(`systemFor(${JSON.stringify(m)}) differs from the web source`);
  }
  if (ok === modes.length) pass(`all ${ok} rewrite-system modes match the web source`);
}

console.log("mobile ⇄ web parity check\n");
for (const step of [
  checkAccents,
  checkLocales,
  checkDplInserts,
  checkProviders,
  checkLocalSettings,
  checkListOps,
  checkRewriteSystems,
  checkSurfaces,
]) {
  await step();
  console.log("");
}
if (failures) {
  console.error(
    `✗ ${failures} parity mismatch(es) — update the mobile port to match the web source.`,
  );
  process.exit(1);
}
console.log("✓ mobile is in parity with the web sources for every ported catalog.");
