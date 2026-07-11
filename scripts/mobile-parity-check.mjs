/**
 * Mobile ⇄ web parity check.
 *
 * TWO KINDS OF CHECK LIVE HERE — know the difference before adding one:
 *
 * 1. **Drift checks** (`checkAccents`, `checkLocales`, `checkDplInserts`, `checkListOps`,
 *    `checkLocalSettings`) compare a mobile HAND-PORT against the web source, so a copy that falls
 *    behind fails loudly. These are a **symptom of duplication, not a cure** — each one is a standing
 *    invitation to delete the copy and import the shared thing instead. When the copy goes, the check
 *    goes with it. See `notes/plans/de-duplication.md`.
 *
 *    Already retired this way: **`checkProviders`** and **`checkRewriteSystems`**. The mobile target
 *    no longer re-declares the ~40 providers or re-states the rewrite system prompts — it derives
 *    both from `targets/shared/` (see `targets/mobile/lib/imageProviders.js`). Comparing that against
 *    the web source would be comparing a file to itself: **you cannot drift from yourself.** The
 *    derivation rules are asserted for real in `targets/mobile/lib/__tests__/imageProviders.test.js`.
 *
 * 2. **Surface parity** (`checkSurfaces`) asserts the mobile UI EXPOSES every web feature — the
 *    owner's full-parity mandate (no size-based feature loss, no "mobile is simpler" build). This is
 *    NOT a drift check and does not go away when code is shared: sharing an engine guarantees nothing
 *    about whether a screen actually surfaces a control. **Keep it.**
 *
 * Engine/data parity is covered separately by scripts/metro-parity-check.mjs.
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
    [
      "Manage",
      "two roots (Blocks + Lists)",
      "manageScreen",
      /readUserTree\("blocks"\)[\s\S]*readUserTree\("lists"\)/,
    ],
    ["Manage", "nested folder tree", "manageScreen", /ManageTree/],
    [
      "Manage",
      "new block / list create",
      "manageScreen",
      /createBlock[\s\S]*createList|createList[\s\S]*createBlock/,
    ],
    ["Manage", "folder create (nested name) + delete", "manageScreen", /deleteUserFolder/],
    ["Manage", "built-in browse + override", "manageScreen", /BuiltinBrowser/],
    ["Manage", "override copies to overlay", "builtin", /onOverride/],
    ["Manage", "runtime overlay wiring", "manageScreen", /refreshOverlay/],
    // Block (generator) editor
    ["Manage", "block DPL editor", "manageBlock", /DplMiniEditor/],
    ["Manage", "block Insert menu", "manageBlock", /InsertMenu/],
    ["Manage", "block Refine steppers", "manageBlock", /REFINE_DIMS/],
    [
      "Manage",
      "block Modify / Draft",
      "manageBlock",
      /dpl-custom[\s\S]*dpl-create|dpl-create[\s\S]*dpl-custom/,
    ],
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

console.log("mobile ⇄ web parity check\n");
for (const step of [
  checkAccents,
  checkLocales,
  checkDplInserts,
  checkListOps,
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
