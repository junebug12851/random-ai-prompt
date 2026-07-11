/**
 * Mobile ⇄ web parity check.
 *
 * TWO KINDS OF CHECK LIVE HERE — know the difference before adding one:
 *
 * 1. **Drift checks** compare a mobile HAND-PORT against the web source, so a copy that falls behind
 *    fails loudly. These are a **symptom of duplication, not a cure** — each one is a standing
 *    invitation to delete the copy and import the shared thing instead. When the copy goes, the check
 *    goes with it. See `notes/plans/de-duplication.md`.
 *
 *    Only TWO are left, and each names the copy that still needs promoting:
 *      • `checkDplInserts` → `targets/mobile/lib/dplInserts.js` (the DPL insert catalog — engine grammar).
 *      • `checkLocales`    → the mobile locale list.
 *
 *    Already retired, because the copy is gone: **`checkProviders`**, **`checkRewriteSystems`**,
 *    **`checkLocalSettings`** (mobile derives all ~40 providers + the rewrite system prompts + their
 *    settings from `targets/shared/`), **`checkListOps`** (both targets import `engine/listEditorOps.js`),
 *    and **`checkAccents`** (both read `targets/shared/theme/`). Comparing any of those against the web
 *    source would be comparing a file to itself: **you cannot drift from yourself.** They're replaced by
 *    real contract tests — e.g. `targets/mobile/lib/__tests__/imageProviders.test.js`.
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
import { readFileSync } from "node:fs";
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

// ---------- 2. Locales: mobile real locale (en) present in web i18n LOCALES ----------
async function checkLocales() {
  console.log("Locales (themeData.js  ⇄  i18n/config.js)");
  // Read the SOURCE rather than importing it: themeData.js now re-exports the shared theme index
  // via Metro's bare `shared/` alias, which plain Node can't resolve.
  const themeSrc = readFileSync(join(MOBILE, "lib/themeData.js"), "utf8");
  const LOCALES = [...themeSrc.matchAll(/\{\s*id:\s*"([a-z-]+)"/g)].map((m) => ({ id: m[1] }));
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
    // NOTE: this marker used to be /suggestions/, which ALSO matched the caret-completion strip — two
    // different features that happen to share the word. The shuffle/random-suggestion control was
    // missing from mobile for months and this check passed anyway. Markers must be specific enough to
    // name ONE feature. (Found by looking at a screenshot; see notes/version 2.56.0.)
    ["Generate", "completion strip (caret autocomplete)", "generate", /activeToken\(/],
    // Match the WIRING, not the import. `/ShuffleIcon/` alone is satisfied by the import line even
    // when the button is gone — which is precisely the mistake this whole block exists to fix.
    ["Generate", "random suggestion + shuffle", "generate", /onPress=\{useSuggestion\}/],
    ["Generate", "suggestion advertised in placeholder", "generate", /Try: \$\{suggestion\}/],
    ["Generate", "generate button", "generate", /SparkleIcon/],
    ["Generate", "negative prompt tab", "generate", /composeMode|Negative/],
    ["Generate", "wrapper button", "generate", /[Ww]rapper/],
    ["Generate", "share link", "generate", /shareUrl|Share link/],
    // (The old `["random suggestion", /suggestion/]` marker lived here. It matched the *completion*
    // strip's `suggestions` array, so it passed for months while the actual random-suggestion +
    // shuffle feature did not exist on mobile at all. Replaced by the three specific markers above —
    // a marker that can be satisfied by an unrelated identifier is worse than no marker, because it
    // buys false confidence.)
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

console.log("mobile ⇄ web parity check\n");
for (const step of [
  checkLocales,
  checkDplInserts,
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
