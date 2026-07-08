/**
 * The SPA's browser-engine facade: wires the shared `core/` engine to the runtime (disk-backed)
 * loader, and exposes generation, live preview, the categorized building blocks, presets, and a
 * hot-apply refresh.
 *
 * The loader is `runtimeLoader`: until a disk snapshot is fetched (local mode only) it delegates to
 * the build-time bundle, so first paint and the online build behave exactly as before; once a
 * snapshot is installed (via {@link refreshCatalog}) the catalog is served live from disk and edits
 * hot-apply. The engine and the classifier read everything through the loader on each call, so a
 * refresh is just: install the snapshot, re-run `promptFiles.loadAll()`, and notify subscribers —
 * no engine rebuild needed.
 * @module gui/lib/promptEngine
 */
import { createEngine } from "../../../../engine/core/engine.js";
import compileDpl from "../../../../engine/core/dpl/dpl.js";
import { forEngine } from "../../../../engine/promptRun.js";
import promptFiles from "../../../../engine/promptFilesAndSuggestions.js";
import { computeButtonNames, compareNames } from "../../../../engine/listManifest.js";
import { isGatedBlock } from "../../../../engine/gatedLists.js";
import { getCustomPresets } from "./customStore.js";
import { runtimeLoader } from "./runtimeLoader.js";
import { initBrowserCatalog } from "../../../../engine/core/browserLoader.js";
import { getSnapshot } from "./manageApi.js";

// The SPA engine reads all data through the runtime loader (bundle until a disk snapshot is set).
const loader = runtimeLoader;

promptFiles.configure(loader);
const engine = createEngine(loader);

// Populate the classifier pools (used by the {#random-prompt} suggestion builder). Re-run on refresh.
promptFiles.loadAll();

// The bundled prompt corpus (~430 KB) is code-split into its own chunk and loaded LAZILY at runtime
// so it's kept OFF the first-paint module graph (see browserLoader.js / browserCatalogData.js). The
// app shell renders first; the corpus is fetched only once {@link ensureCatalog} is called — the SPA
// does that from a mount effect (after paint), and tests await it directly. When it resolves the
// classifier is rebuilt and subscribers are notified, so the palette + generation populate. Every
// catalog getter returns empty until then (a brief blank palette that fills in).
let _catalogReady = null;

/**
 * Kick off the one-time load of the bundled prompt corpus (idempotent) and, on completion, rebuild
 * the classifier and notify catalog subscribers. Returns a promise that resolves when the corpus is
 * ready. Deliberately NOT invoked at module load, so the fetch starts after first paint rather than
 * competing with the entry chunks.
 * @returns {Promise<void>} Resolves once the bundled catalog is loaded.
 */
export function ensureCatalog() {
  if (!_catalogReady) {
    _catalogReady = initBrowserCatalog().then(() => {
      promptFiles.loadAll();
      notifyCatalog();
    });
  }
  return _catalogReady;
}

// ---- Hot-apply refresh + catalog-change subscription ----

let catalogVersion = 0;
const listeners = new Set();

/**
 * @returns {number} A counter that increments on every catalog change (for React deps).
 */
export function getCatalogVersion() {
  return catalogVersion;
}

/**
 * Subscribe to catalog changes (a hot-apply refresh). Returns an unsubscribe function.
 * @param {Function} fn Called with the new version number on each change.
 * @returns {Function} Unsubscribe.
 */
export function subscribeCatalog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyCatalog() {
  catalogVersion += 1;
  for (const fn of [...listeners]) {
    try {
      fn(catalogVersion);
    } catch {
      /* a bad subscriber shouldn't break the refresh */
    }
  }
}

/**
 * Fetch the live disk snapshot (local mode) and hot-apply it: the lists, `.dpl` generators,
 * sidecars, and folder structure are re-read from disk, the classifier is rebuilt, and subscribers
 * are notified so the UI re-renders. A no-op (returns false) when there's no local backend.
 * @returns {Promise<boolean>} Whether a snapshot was installed.
 */
export async function refreshCatalog() {
  const snap = await getSnapshot();
  if (!snap) return false;
  runtimeLoader.setSnapshot(snap);
  promptFiles.loadAll();
  notifyCatalog();
  return true;
}

/**
 * @param {object} settings The generation settings.
 * @param {string|number} [explicitSeed] Force this exact seed (used by the batch roll to fork).
 * @returns {string} One generated prompt.
 */
export function generatePrompt(settings, explicitSeed) {
  return engine.generate(forEngine(settings, explicitSeed));
}
/**
 * @param {object} settings The generation settings (`promptCount`).
 * @returns {string[]} That many generated prompts.
 */
export function generatePrompts(settings) {
  return engine.generateMany(forEngine(settings));
}
/**
 * Expand a prompt for an on-screen PREVIEW / illustrative example — the live-preview eye, the
 * building-block hover examples, the editor/insert-bar examples, and the cycling suggestion. These
 * must always re-roll a fresh example and stay completely independent of the user's seed: they never
 * read the pinned `promptSeed` (so a pinned prompt doesn't freeze every preview) nor write/advance it.
 * We force the random path (a throwaway preview seed that re-rolls each call) by overriding
 * `randomSeed` on the way into the engine only; the caller's settings object is never mutated. This
 * is also the historical behaviour of `expandPrompt` (it predates seeding), so preview callers need
 * no change. For a seed-honouring expansion (the real negative-prompt roll) use
 * {@link expandPromptSeeded}.
 * @param {string} prompt The DPL/prompt to expand.
 * @param {object} settings The generation settings (seed fields are ignored).
 * @returns {string} A fresh, randomly-rolled expansion.
 */
export function expandPrompt(prompt, settings) {
  return engine.generate({ ...forEngine({ ...settings, randomSeed: true }), prompt });
}

/**
 * Expand a prompt HONOURING the current seed settings — so a pinned roll reproduces it. Used for the
 * real negative-prompt roll (part of the generated image), not for previews.
 * @param {string} prompt The prompt to expand.
 * @param {object} settings The generation settings.
 * @returns {string} The expanded prompt (deterministic when a seed is pinned).
 */
export function expandPromptSeeded(prompt, settings) {
  return engine.generate({ ...forEngine(settings), prompt });
}

/**
 * Render one wrapper box (a DPL snippet — the user can use bullets/probability) into a flat token
 * string. Tokens it emits ({#…}, {list}, <exp>) are resolved later by the generation pipeline.
 * @param {string} text The wrapper box's DPL text.
 * @param {object} [settings] The generation settings (passed to any JS the snippet calls).
 * @returns {string} The rendered token string (or "" when blank).
 */
export function renderWrapperPart(text, settings = {}) {
  if (!text || !text.trim()) return "";
  try {
    const mod = compileDpl(`Start\n===\n${text}`, { resolveJs: () => "" });
    return mod.default(settings, {}, {}) || "";
  } catch {
    return text; // fall back to the raw text if it isn't valid DPL
  }
}

// ---- Building blocks (the "keyword cloud"), categorized like the original ----

const lastSeg = (f) => (f === "" ? "misc" : f.split("/").pop());

// The default category priority when a folder's sidecar sets none (lower = higher in the picker).
const DEFAULT_CAT_PRIORITY = 1000;

// Expansion generators (referenced as {#rays}, {#dap}, …) live under expansion/ and are NOT
// listed as pickable chips — they're excluded from the Blocks walk.
const isExpansionKey = (n) => n.startsWith("expansion/");

// The virtual "any" wildcard category (priority 0 → leads the picker): `{#any}` (and -sfw/-nsfw)
// draws one random generator from the whole catalog.
const anyGroup = () => ({
  priority: 0,
  name: "any",
  pill: {
    category: true,
    label: "any",
    token: "{#any}",
    description: "One random generator (SFW; +NSFW when adult is on).",
  },
  entries: [
    { token: "{#any-sfw}", label: "any-sfw", description: "One random generator, SFW only." },
    {
      token: "{#any-nsfw}",
      label: "any-nsfw",
      description: "One random generator, including NSFW (adult mode only).",
    },
  ],
});

// The virtual "special" category (priority 9000 → trails the picker): engine controls (the
// seed-salt) that aren't drawn from any list or generator.
const specialGroup = () => ({
  priority: 9000,
  name: "special",
  pill: {
    category: true,
    label: "special",
    description: "Engine controls that aren't drawn from any list or generator.",
  },
  entries: [
    {
      token: "{salt}",
      label: "salt",
      description:
        "Inject a random seed-salt number — nudges the result without changing the prompt.",
    },
  ],
});

/**
 * The categorized building-block groups for the token cloud: Blocks (the generators) and Lists.
 * Recomputed from the **current** loader state on every call, so a hot-apply refresh (or browsing
 * after an edit) shows the live catalog. Within Blocks, the category/folder pills are ordered by
 * each category's sidecar `priority` (ascending; default 1000), with the virtual `any` (0) leading
 * and `special` (9000) trailing.
 * @param {object} [opts]
 * @param {boolean} [opts.includeAdult] When false (default), nsfw generators are hidden entirely
 *   and any category that empties out is dropped.
 * @returns {object[]} The Blocks + Lists groups.
 */
export function getBlocks(opts = {}) {
  const includeAdult = opts.includeAdult === true;

  // --- Catalog derivations, read live from the loader (so edits/refresh are reflected) ---
  const allDynNames = loader.blockNames();
  const forcedDirs = loader.blockForcedPrefixDirs();
  const groupSet = new Set(loader.blockGroupDirs());
  const btnNames = computeButtonNames(allDynNames, forcedDirs);

  // Tooltip text for a generator: prefer the `.dpl` front-matter `description:`, falling back to
  // the optional `.json` sidecar.
  const dpDescFor = (key) => {
    const mod = loader.loadBlock(key);
    return mod?.meta?.description || loader.readBlockMeta(key)?.description || undefined;
  };
  // A generator is adult (hard-hidden when NSFW is off) when its sidecar carries `nsfw: true` or
  // its name carries an `nsfw` token — the same predicate the engine gates on.
  const isNsfwKey = (key) =>
    loader.readBlockMeta(key)?.nsfw === true || isGatedBlock(key);

  // Folder-grouped category descriptors for a set of generator keys.
  const dynCatGroups = (keys) => {
    const visible = includeAdult ? keys : keys.filter((k) => !isNsfwKey(k));
    const byFolder = new Map();
    for (const k of visible) {
      const i = k.lastIndexOf("/");
      const folder = i < 0 ? "" : k.slice(0, i);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(k);
    }
    return [...byFolder.entries()].map(([folder, members]) => {
      const meta = loader.readBlockMeta(folder) || {};
      const pill = { category: true, label: lastSeg(folder), description: dpDescFor(folder) };
      if (groupSet.has(folder)) pill.token = `{#${lastSeg(folder)}}`;
      return {
        priority: typeof meta.priority === "number" ? meta.priority : DEFAULT_CAT_PRIORITY,
        name: lastSeg(folder),
        pill,
        entries: members
          .map((k) => ({ token: `{#${btnNames[k]}}`, label: btnNames[k], description: dpDescFor(k) }))
          .sort((a, b) => compareNames(a.label, b.label)),
      };
    });
  };

  // Shortest unambiguous display token per list.
  const listDisplay = computeButtonNames(loader.listNames(), loader.forcedPrefixDirs());
  const descFor = (n) =>
    (loader.readListMeta(n) || loader.readListMeta(`${n}-sfw`) || null)?.description;
  const forceListFor = (folder) => {
    const m = loader.readListMeta(folder) || loader.readListMeta(`${folder}-sfw`) || null;
    return m?.forceList === true;
  };

  // Build the Lists block as folder categories.
  const listItems = () => {
    const names = loader.listNames();
    const groupDirs = new Set(loader.groupListDirs());
    const byFolder = new Map();
    for (const n of names) {
      if (groupDirs.has(n)) continue; // folder-group names become pills, not entries
      const i = n.lastIndexOf("/");
      const folder = i < 0 ? "" : n.slice(0, i);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(n);
    }
    const cats = [];
    for (const [folder, members] of byFolder) {
      cats.push({
        label: lastSeg(folder),
        token: groupDirs.has(folder) ? `{${listDisplay[folder]}}` : null,
        description: descFor(folder),
        forceList: forceListFor(folder),
        entries: members
          .map((n) => ({ token: `{${listDisplay[n]}}`, label: listDisplay[n], description: descFor(n) }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
    // The reserved `keyword` wildcard isn't a folder/file — give it its own category.
    cats.push({
      label: "keyword",
      token: "{keyword}",
      description: "A random word drawn from ALL loaded vocabulary (every list).",
      entries: [
        { token: "{keyword-sfw}", label: "keyword-sfw", description: "All vocabulary, SFW only." },
        {
          token: "{keyword-nsfw}",
          label: "keyword-nsfw",
          description: "All vocabulary, including NSFW (adult mode only).",
        },
      ],
    });
    cats.sort((a, b) => a.label.localeCompare(b.label));
    const out = [];
    for (const c of cats) {
      const pill = { category: true, label: c.label, description: c.description };
      if (c.token) pill.token = c.token;
      if (c.forceList) pill.forceList = true;
      out.push(pill, ...c.entries);
    }
    return out;
  };

  const dynKeys = allDynNames.filter((n) => !isExpansionKey(n));
  const blockItems = [anyGroup(), ...dynCatGroups(dynKeys), specialGroup()]
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => a.priority - b.priority || compareNames(a.name, b.name))
    .flatMap((g) => [g.pill, ...g.entries]);

  // With adult off, drop any explicitly-NSFW button and prune an emptied category header.
  const dropNsfw = (items) => {
    if (includeAdult) return items;
    const kept = items.filter((i) => i.category || !/nsfw/i.test(i.token || ""));
    return kept.filter((it, k) => !it.category || (kept[k + 1] && !kept[k + 1].category));
  };

  return [
    {
      title: "Blocks",
      hint: "Every building block — scenes, subjects, fragments, and styles.",
      items: dropNsfw(blockItems),
    },
    {
      title: "Lists",
      hint: "Word lists — each insertion becomes one random entry from the list.",
      items: dropNsfw(listItems()),
    },
  ];
}

/**
 * Flatten the building-block catalog into autocomplete entries for the DPL editor.
 * @returns {Array<{token: string, label: string, kind: ("gen"|"list"), description: (string|undefined), group: string, category: string}>}
 *   The completion entries.
 */
export function getDplCompletions() {
  const out = [];
  const seen = new Set();
  for (const b of getBlocks()) {
    let category = b.title;
    for (const it of b.items) {
      if (it.category) category = it.label || b.title;
      if (!it.token || seen.has(it.token)) continue;
      seen.add(it.token);
      out.push({
        token: it.token,
        label: it.label,
        kind: it.token.startsWith("{#") ? "gen" : "list",
        description: it.description,
        group: b.title,
        category,
      });
    }
  }
  return out;
}

/**
 * @returns {string[]} The sorted list names.
 */
export function getListNames() {
  return loader.listNames().slice().sort();
}

/**
 * @returns {string[]} The sorted preset names (built-in + the user's custom presets).
 */
export function getPresetNames() {
  return [...new Set([...loader.presetNames(), ...Object.keys(getCustomPresets())])].sort();
}

/**
 * Load a preset's settings (a custom preset shadows a built-in of the same name).
 * @param {string} name The preset name.
 * @returns {object} The preset settings (or `{}` if unknown).
 */
export function loadPreset(name) {
  const custom = getCustomPresets();
  if (name in custom) return custom[name];
  return loader.loadPreset(name) || {};
}
