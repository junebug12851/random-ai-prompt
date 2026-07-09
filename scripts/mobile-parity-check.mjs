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

// ---------- 4. Image providers: every mobile provider is browser-direct in the web configs ----------
async function checkProviders() {
  console.log("Image providers (imageProviders.js  ⇄  web shared/*/config.js)");
  const { IMAGE_PROVIDERS } = await imp(join(MOBILE, "lib/imageProviders.js"));
  const shared = join(WEB, "shared");
  const web = {};
  for (const d of readdirSync(shared, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    let cfg;
    try {
      cfg = readFileSync(join(shared, d.name, "config.js"), "utf8");
    } catch {
      continue;
    }
    const id = cfg.match(/id:\s*"([^"]+)"/)?.[1];
    const transport = cfg.match(/transport:\s*"([^"]+)"/)?.[1];
    const tier = cfg.match(/tier:\s*"([^"]+)"/)?.[1];
    if (id) web[id] = { transport, tier };
  }
  for (const p of IMAGE_PROVIDERS) {
    const w = web[p.id];
    if (!w) {
      fail(`mobile provider "${p.id}" has no web config`);
      continue;
    }
    if (p.local) {
      // local-direct providers hit the user's OWN server; on native there's no CORS, so no backend
      // of ours is needed. They must be local-direct on the web too.
      if (w.transport === "local-direct") pass(`"${p.id}" is local-direct on the web (local server)`);
      else fail(`"${p.id}" is marked local on mobile but "${w.transport}" on the web`);
    } else if (w.transport !== "browser-direct") {
      fail(
        `"${p.id}" is "${w.transport}" on the web, not browser-direct — it can't run on mobile (no backend)`,
      );
    } else {
      pass(`"${p.id}" is browser-direct on the web`);
    }
  }
  // Info (not a failure): browser-direct IMAGE providers on the web not yet wired on mobile.
  const mobIds = new Set(IMAGE_PROVIDERS.map((p) => p.id));
  const missingBd = Object.entries(web)
    .filter(([id, w]) => w.transport === "browser-direct" && w.tier === "api" && !mobIds.has(id))
    .map(([id]) => id);
  if (missingBd.length)
    console.log(`  ℹ web browser-direct image providers not yet on mobile: ${missingBd.join(", ")}`);
  const missingLocal = Object.entries(web)
    .filter(([id, w]) => w.transport === "local-direct" && !mobIds.has(id))
    .map(([id]) => id);
  if (missingLocal.length)
    console.log(`  ℹ web local-direct image providers not yet on mobile: ${missingLocal.join(", ")}`);
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
    if (!rel) { fail(`no known web settings.js mapped for local provider "${p.id}"`); continue; }
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

console.log("mobile ⇄ web parity check\n");
for (const step of [checkAccents, checkLocales, checkDplInserts, checkProviders, checkLocalSettings]) {
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
