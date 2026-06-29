/**
 * The Home composer — a focused two-pane prompt workspace. The left pane is the
 * building-block cloud (keywords, lists, expansions, dynamic prompts); the right
 * pane is an editor-style composer: a prompt box that fills its space with a
 * rotating random suggestion, a compact action toolbar (generate / random /
 * clear / save / share), inline save + share panels, and the generated-prompt
 * list.
 *
 * Image generation is back (per the active provider: api-tier renders into the Gallery;
 * the syntax tier copies a formatted prompt). Still removed (see
 * notes/plans/removed-pending-readd.md): the chaos knob, presets, and the Normal/Anime style
 * toggle (the anime word lists mix SFW + explicit adult tags and need a proper split first).
 * @module gui/components/Home
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import {
  getBlocks,
  generatePrompt,
  renderWrapperPart,
  expandPrompt,
  subscribeCatalog,
} from "../lib/promptEngine.js";
import { getDefaultWrapper } from "../lib/wrapperStore.js";
import { shareUrl } from "../lib/share.js";
import { getProvider } from "../lib/providers/index.js";
import { flattenForProvider } from "../lib/useProvider.js";
import { ingestImage, isOutputFile, deleteImageFile } from "../lib/output.js";
import { softLockedForNsfw } from "../lib/contentPolicy.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { rewritePrompt } from "../lib/rewrite.js";
import WrapperButton from "./WrapperFab.jsx";
import PromptResult from "./PromptResult.jsx";
import Settings from "./Settings.jsx";
import InlineImageControls from "./InlineImageControls.jsx";
import LivePreview from "./LivePreview.jsx";
import DplEditor from "./DplEditor.jsx";
import DplInsertBar from "./DplInsertBar.jsx";
import DplStatus from "./DplStatus.jsx";

const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes

// App-orchestration keys that don't describe HOW an image was made — kept out of the sidecar's
// settings snapshot so the single view's details table reflects only the provider's own knobs
// (e.g. an OpenAI image shouldn't carry another provider's sampler/steps from `providerParams`).
const SNAPSHOT_DROP = new Set([
  "keys", "providerParams", "prompt", "promptCount", "locale", "includeAdult", "autoFix",
  "autoKeyword", "autoAddFx", "autoAddArtists", "rewriteProvider", "wrapper", "wrapperName",
  "wrapperParams", "useAutoSections", "provider",
]);

/**
 * A clean, provider-scoped settings snapshot for an image sidecar: scalar provider knobs only,
 * with app-orchestration keys, nested objects (like `providerParams`), and empties dropped.
 * @param {object} obj The flattened settings (`flat` + the final negative prompt).
 * @returns {object} The trimmed snapshot.
 */
function cleanSnapshot(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SNAPSHOT_DROP.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object" || typeof v === "function") continue;
    out[k] = v;
  }
  return out;
}

// A group's flat `items` array is a run of [folder pill, its chips, folder pill, its chips, …].
// Split it back into folder sub-categories so the palette can offer an "All" view plus one sub-tab
// per folder. A pill that carries a token (an insertable group like {#scene} / {word}) is kept on
// its category so the folder sub-tab can offer the whole-group insert at the top.
// Categories that get NO sub-tab of their own — the wildcard/engine pseudo-folders. They still
// appear in the All view as a normal category pill (header + their buttons); they just don't earn a
// folder shortcut in the tree. Every real folder (scene, subject, user, …) keeps its sub-tab.
const MERGED_CATS = ["any", "special"];

// The folder sub-categories to show for a group: real folders only (the merged wildcard dropped).
// For Lists, a folder holding a single list is folded into All too, unless its sidecar forces it
// (`forceList`). Their buttons still appear under All regardless.
function foldersOf(group) {
  let cats = splitCats(group.items).filter((c) => !MERGED_CATS.includes(c.label));
  if (group.title === "Lists") cats = cats.filter((c) => c.items.length > 1 || c.forceList);
  return cats;
}

function splitCats(items) {
  const cats = [];
  let cur = null;
  for (const it of items) {
    if (it.category) {
      cur = {
        label: it.label,
        token: it.token,
        description: it.description,
        forceList: it.forceList,
        items: [],
      };
      cats.push(cur);
    } else {
      if (!cur) {
        cur = { label: "misc", items: [] };
        cats.push(cur);
      }
      cur.items.push(it);
    }
  }
  return cats;
}

// Crisp monochrome action icons (stroke = currentColor) so the four field
// buttons read as one cohesive set.
const ico = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const ShareIcon = () => (
  <svg {...ico} aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const ShuffleIcon = () => (
  <svg {...ico} aria-hidden="true">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);
const SparkleIcon = () => (
  <svg {...ico} fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" />
    <path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </svg>
);
const WandIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h0M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
  </svg>
);
const TagIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const GearIcon = () => (
  <svg {...ico} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const msgs = defineMessages({
  aiFallback: { id: "home.aiFallback", defaultMessage: "AI" },
  rewriteNoKey: {
    id: "home.rewriteNoKey",
    defaultMessage: "Auto-rewrite is on but the rewrite provider has no API key (gear → Auto-fix).",
  },
  rewriteFailed: { id: "home.rewriteFailed", defaultMessage: "Auto-rewrite failed: {error}" },
  confirmDeleteImage: {
    id: "home.confirmDeleteImage",
    defaultMessage:
      "Delete this image from disk too?\n\nOK = delete the file\nCancel = just remove it from view",
  },
  confirmDeleteBatch: {
    id: "home.confirmDeleteBatch",
    defaultMessage: "Delete this batch's image files from disk too?",
  },
  confirmDeletePromptImgs: {
    id: "home.confirmDeletePromptImgs",
    defaultMessage: "Delete all of this prompt's image files from disk too?",
  },
  confirmClearAll: {
    id: "home.confirmClearAll",
    defaultMessage:
      "Clear all results — delete their {count, plural, one {# image file} other {# image files}} from disk too?",
  },
  buildingBlocks: { id: "home.buildingBlocks", defaultMessage: "Building blocks" },
  searchBlocks: { id: "home.searchBlocks", defaultMessage: "Search blocks…" },
  noBlocks: { id: "home.noBlocks", defaultMessage: "No building blocks match “{query}”." },
  all: { id: "home.all", defaultMessage: "All" },
  moreFilter: {
    id: "home.moreFilter",
    defaultMessage: "+{count} more — keep typing to filter",
  },
  composeModeAria: {
    id: "home.composeModeAria",
    defaultMessage: "Edit the prompt or the negative prompt",
  },
  tabPrompt: { id: "home.tabPrompt", defaultMessage: "Prompt" },
  tabNegative: { id: "home.tabNegative", defaultMessage: "Negative" },
  ariaNegative: { id: "home.ariaNegative", defaultMessage: "Negative prompt (DPL)" },
  ariaPrompt: { id: "home.ariaPrompt", defaultMessage: "Prompt (DPL)" },
  phNegative: {
    id: "home.phNegative",
    defaultMessage: "Negative prompt — what to keep out (DPL), e.g. blurry, lowres, '{#bad-anatomy}'",
  },
  phTry: { id: "home.phTry", defaultMessage: "Try: {suggestion}" },
  phPrompt: {
    id: "home.phPrompt",
    defaultMessage: "Type a prompt, or use the building blocks on the left…",
  },
  clearNegative: { id: "home.clearNegative", defaultMessage: "Clear the negative prompt" },
  clearPrompt: { id: "home.clearPrompt", defaultMessage: "Clear the prompt" },
  negativePreview: { id: "home.negativePreview", defaultMessage: "Negative preview" },
  promptPreview: { id: "home.promptPreview", defaultMessage: "Prompt preview" },
  promptSettings: { id: "home.promptSettings", defaultMessage: "Prompt settings" },
  close: { id: "home.close", defaultMessage: "close" },
  promptsPerRunTitle: {
    id: "home.promptsPerRunTitle",
    defaultMessage: "How many prompts to generate per run",
  },
  promptsLabel: { id: "home.promptsLabel", defaultMessage: "Prompts" },
  promptsPerRunAria: { id: "home.promptsPerRunAria", defaultMessage: "Prompts per run" },
  autoFixOn: {
    id: "home.autoFixOn",
    defaultMessage: "Auto-fix the prompt with {provider} before generating",
  },
  autoFixOff: {
    id: "home.autoFixOff",
    defaultMessage: "Pick a Text provider (header → Providers) to enable auto-fix",
  },
  autoFixAria: { id: "home.autoFixAria", defaultMessage: "Auto-fix prompt" },
  keywordOn: {
    id: "home.keywordOn",
    defaultMessage:
      "Keyword-translate the prompt with {provider} (use a clean tag list instead) before generating",
  },
  keywordOff: {
    id: "home.keywordOff",
    defaultMessage: "Pick a Text provider (header → Providers) to enable keyword translate",
  },
  keywordAria: { id: "home.keywordAria", defaultMessage: "Keyword-translate prompt" },
  shareLink: { id: "home.shareLink", defaultMessage: "Share link" },
  randomTitle: { id: "home.randomTitle", defaultMessage: "Random — drop a suggestion in" },
  randomAria: { id: "home.randomAria", defaultMessage: "Random suggestion" },
  generateTitle: {
    id: "home.generateTitle",
    defaultMessage: "{count, plural, one {Generate prompt} other {Generate prompts}}",
  },
  generateAria: { id: "home.generateAria", defaultMessage: "Generate prompt" },
  shareInputAria: {
    id: "home.shareInputAria",
    defaultMessage: "Shareable link that restores these settings",
  },
  copied: { id: "home.copied", defaultMessage: "✓ Copied" },
  copy: { id: "home.copy", defaultMessage: "Copy" },
  promptsHeading: { id: "home.promptsHeading", defaultMessage: "Prompts" },
  generatedCount: {
    id: "home.generatedCount",
    defaultMessage: "{count} generated · {provider}",
  },
  clearAllTitle: { id: "home.clearAllTitle", defaultMessage: "Clear all results" },
  clearAll: { id: "home.clearAll", defaultMessage: "Clear all" },
  example: { id: "home.example", defaultMessage: "Example:" },
  nsfwProceed: {
    id: "home.nsfwProceed",
    defaultMessage: "NSFW mode is on. Generate with {provider} anyway?",
  },
});

/**
 * The compose workspace.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @param {Function} [props.onOpenImage] Open a generated image (by served path) in the single view.
 * @returns {JSX.Element}
 */
export default function Home({ settings, setSettings, onOpenImage }) {
  const intl = useIntl();
  const [version, setVersion] = useState(0); // bump to refresh custom blocks
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(""); // top group: Blocks | Lists
  const [activeSub, setActiveSub] = useState("All"); // folder sub-tab within the active group
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [panel, setPanel] = useState(""); // "" | "save" | "share"
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // prompt-settings gear popover
  const [composeMode, setComposeMode] = useState("prompt"); // composer target: "prompt" | "negative"
  // Hover tooltip for a building block: its label, description (piped from the v3 file /
  // sidecar), and a LIVE example output that re-rolls while the pointer rests on the chip.
  const [tip, setTip] = useState(null); // { token, label, description, x, y }
  const [tipEx, setTipEx] = useState("");

  // Rebuild the block palette when custom blocks change or the NSFW switch flips (nsfw-flagged
  // generators are hidden entirely when adult is off).
  const blocks = useMemo(
    () => getBlocks({ includeAdult: settings.includeAdult }),
    [version, settings.includeAdult],
  );

  // Rebuild the palette when the catalog hot-applies (a Manage edit / refresh re-reads disk).
  useEffect(() => subscribeCatalog(() => setVersion((v) => v + 1)), []);

  // --- Active image provider (selection lives in settings; knobs are per-provider) ---
  const provider = getProvider(settings.provider);
  const pid = provider?.id;
  const supportsNegative = !!provider?.capabilities?.negativePrompt;
  // The text (prompt-rewrite) provider, if one is chosen — drives the always-visible auto-fix /
  // keyword buttons (disabled when there's none) and their tooltips (its text-model label).
  const rewriteProv =
    settings.rewriteProvider && settings.rewriteProvider !== "none"
      ? getProvider(settings.rewriteProvider)
      : null;
  const rewriteLabel =
    rewriteProv?.rewriteLabel || rewriteProv?.label || intl.formatMessage(msgs.aiFallback);
  const hasRewrite = !!rewriteProv;
  const [providerFmt, setProviderFmt] = useState(null); // syntax/plain tier: prompt formatter
  const [providerDefaults, setProviderDefaults] = useState({});
  const [imgError, setImgError] = useState("");
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;
  const promptEditorRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const p = getProvider(settings.provider);
    Promise.resolve(p?.loadSettings ? p.loadSettings() : { defaults: {} }).then(
      (m) => alive && setProviderDefaults(m?.defaults || {}),
    );
    if (p?.loadFormat) p.loadFormat().then((f) => alive && setProviderFmt(() => f));
    else setProviderFmt(null);
    return () => {
      alive = false;
    };
  }, [settings.provider]);

  // The flat settings an adapter/formatter reads: app settings + this provider's namespaced
  // params (under its schema defaults) + the dialect mode.
  const flat = flattenForProvider(settings, providerDefaults);
  const canGenerateImages = provider?.tier === "api" && !!provider?.loadGenerate;

  // Add a fresh batch of images beneath a prompt via the active provider's generate adapter.
  // `promptText` is passed for auto-render (state may not be committed yet); manual clicks omit it.
  async function makeBatch(promptId, promptText, promptDplArg) {
    let text = promptText ?? prompts.find((x) => x.id === promptId)?.text;
    if (!text) return;
    const entry0 = prompts.find((x) => x.id === promptId);
    // Each prompt + negative is recorded in three layers in the sidecar: the DPL source, the
    // deterministic engine roll, and (when auto-fix is on) the AI translation. `final` is what
    // was actually sent. `*Arg` params carry the values for auto-render, where the just-added
    // entry isn't in committed state yet.
    const promptDpl = promptDplArg ?? entry0?.dpl ?? null;
    let promptRoll = text; // deterministic engine roll (pre-AI)
    let promptAi = null; // AI translation, or null
    if (entry0?.original) {
      // This prompt was already auto-fixed on a prior batch — reuse that mapping.
      promptRoll = entry0.original;
      promptAi = entry0.text;
      text = entry0.text;
    }
    const batchId = nextId();
    const count = Math.max(1, Number(flat.batchSize) || 1);
    setImgError("");
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId
          ? { ...x, batches: [{ id: batchId, busy: true, count, images: [] }, ...x.batches] }
          : x,
      ),
    );
    try {
      // Two independent rewrite passes share one text provider: prose auto-fix (`autoFix`) and
      // keyword/tag-list translation (`autoKeyword`). When both are on they chain — fix first,
      // then keyword-translate the fixed text.
      const hasRewriteProvider = settings.rewriteProvider && settings.rewriteProvider !== "none";
      const useFix = settings.autoFix && hasRewriteProvider;
      const useKeyword = settings.autoKeyword && hasRewriteProvider;
      const rkey = useFix || useKeyword ? effectiveKey(settings.rewriteProvider, settings) : "";
      if ((useFix || useKeyword) && !rkey) {
        setImgError(intl.formatMessage(msgs.rewriteNoKey));
      }

      // --- Main prompt: fix → keyword-translate (per the toggles), once per prompt, then cache. ---
      if ((useFix || useKeyword) && rkey && !entry0?.original) {
        try {
          let working = text;
          if (useFix) {
            const fixed = await rewritePrompt({
              providerId: settings.rewriteProvider,
              prompt: working,
              key: rkey,
            });
            if (fixed && fixed.trim()) working = fixed.trim();
          }
          if (useKeyword) {
            const tagged = await rewritePrompt({
              providerId: settings.rewriteProvider,
              prompt: working,
              key: rkey,
              mode: "keyword",
            });
            if (tagged && tagged.trim()) working = tagged.trim();
          }
          if (working !== text) {
            promptRoll = text;
            text = working;
            promptAi = text;
            setPrompts((ps) =>
              ps.map((x) => (x.id === promptId ? { ...x, original: promptRoll, text } : x)),
            );
          }
        } catch (e) {
          setImgError(intl.formatMessage(msgs.rewriteFailed, { error: e.message || String(e) }));
        }
      }

      // --- Negative prompt: roll its DPL, then AI-translate it too (when auto-fix is on). ---
      const negDpl = flat.negativePrompt || "";
      let negRoll = negDpl ? expandPrompt(negDpl, { ...settings, mode: flat.mode }) : "";
      let negAi = null;
      if (entry0?.negRoll !== undefined) {
        // Already processed on a prior batch — reuse so we don't re-call the rewrite API.
        negRoll = entry0.negRoll;
        negAi = entry0.negAi ?? null;
      } else if ((useFix || useKeyword) && rkey && negRoll.trim()) {
        try {
          let workingNeg = negRoll;
          if (useFix) {
            const fixedNeg = await rewritePrompt({
              providerId: settings.rewriteProvider,
              prompt: workingNeg,
              key: rkey,
            });
            if (fixedNeg && fixedNeg.trim()) workingNeg = fixedNeg.trim();
          }
          if (useKeyword) {
            const taggedNeg = await rewritePrompt({
              providerId: settings.rewriteProvider,
              prompt: workingNeg,
              key: rkey,
              mode: "keyword",
            });
            if (taggedNeg && taggedNeg.trim()) workingNeg = taggedNeg.trim();
          }
          if (workingNeg !== negRoll) negAi = workingNeg;
        } catch {
          // Best-effort: a failed negative rewrite just falls back to the rolled negative.
        }
      }
      const negFinal = negAi || negRoll;
      setPrompts((ps) =>
        ps.map((x) => (x.id === promptId ? { ...x, negRoll, negAi } : x)),
      );

      const generate = await provider.loadGenerate();
      const key = effectiveKey(provider.id, settings);
      const { images: imgs } = await generate({
        prompt: text,
        settings: { ...flat, negativePrompt: negFinal },
        key,
      });
      // The full record of how these images were made, written as a sidecar next to each one
      // (read back by the photo gallery). The snapshot is provider-scoped (API keys, app
      // orchestration, and foreign provider params all dropped — never to disk).
      const settingsSnapshot = cleanSnapshot({ ...flat, negativePrompt: negFinal });
      const meta = {
        prompt: { dpl: promptDpl, roll: promptRoll, ai: promptAi, final: text },
        negative: {
          dpl: negDpl || null,
          roll: negRoll || null,
          ai: negAi,
          final: negFinal || null,
        },
        provider: provider.id,
        providerLabel: provider.label,
        settings: settingsSnapshot,
        savedAt: new Date().toISOString(),
      };
      // Funnel every provider's images into the central output folder, then display the saved copies.
      const saved = await Promise.all((imgs || []).map((img) => ingestImage(img, meta)));
      setPrompts((ps) =>
        ps.map((x) =>
          x.id === promptId
            ? {
                ...x,
                batches: x.batches.map((b) =>
                  b.id === batchId ? { ...b, busy: false, images: saved } : b,
                ),
              }
            : x,
        ),
      );
    } catch (e) {
      setImgError(e.message || String(e));
      setPrompts((ps) =>
        ps.map((x) =>
          x.id === promptId ? { ...x, batches: x.batches.filter((b) => b.id !== batchId) } : x,
        ),
      );
    }
  }

  // Remove a single image — optionally deleting the file from disk.
  function removeImage(promptId, batchId, img) {
    if (
      isOutputFile(img) &&
      confirm(intl.formatMessage(msgs.confirmDeleteImage))
    ) {
      deleteImageFile(img);
    }
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId
          ? {
              ...x,
              batches: x.batches
                .map((b) =>
                  b.id === batchId ? { ...b, images: b.images.filter((i) => i !== img) } : b,
                )
                .filter((b) => b.busy || b.images.length),
            }
          : x,
      ),
    );
  }

  // Remove a whole batch — optionally deleting its files from disk.
  function removeBatch(promptId, batchId) {
    const b = prompts.find((x) => x.id === promptId)?.batches.find((y) => y.id === batchId);
    const imgs = b?.images || [];
    if (imgs.some(isOutputFile) && confirm(intl.formatMessage(msgs.confirmDeleteBatch))) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts((ps) =>
      ps.map((x) =>
        x.id === promptId ? { ...x, batches: x.batches.filter((y) => y.id !== batchId) } : x,
      ),
    );
  }

  // Clear all of a prompt's images — optionally deleting from disk.
  function clearImages(promptId) {
    const imgs = (prompts.find((x) => x.id === promptId)?.batches || []).flatMap((b) => b.images);
    if (
      imgs.some(isOutputFile) &&
      confirm(intl.formatMessage(msgs.confirmDeletePromptImgs))
    ) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts((ps) => ps.map((x) => (x.id === promptId ? { ...x, batches: [] } : x)));
  }

  // All on-disk image files across a list of prompt results.
  const allImagesOf = (list) =>
    (list || []).flatMap((p) => p.batches.flatMap((b) => b.images)).filter(isOutputFile);

  // Clear every result — optionally deleting all their image files from disk.
  function clearAll() {
    const imgs = allImagesOf(prompts);
    if (
      imgs.length &&
      confirm(intl.formatMessage(msgs.confirmClearAll, { count: imgs.length }))
    ) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts([]);
  }

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });

  // The composer edits either the prompt or — for providers that support it — the per-provider
  // negative prompt (kept under providerParams so generation reads it via flattenForProvider).
  // The Prompt/Negative switch lives on the insert bar and only shows when negative is supported.
  const editMode = supportsNegative ? composeMode : "prompt";
  const negative = settings.providerParams?.[pid]?.negativePrompt ?? "";
  const setNegative = (v) =>
    setSettings((s) => ({
      ...s,
      providerParams: {
        ...s.providerParams,
        [pid]: { ...s.providerParams?.[pid], negativePrompt: v },
      },
    }));
  const activeValue = editMode === "negative" ? negative : prompt;
  const setActiveValue = editMode === "negative" ? setNegative : setPrompt;

  // A fresh random prompt suggestion that cycles every few seconds. The latest
  // settings live in a ref so the interval reads current word lists without
  // resetting its timer on every keystroke.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const roll = () => {
      try {
        setSuggestion(generatePrompt({ ...settingsRef.current, prompt: "{#random-words}" }));
      } catch {
        /* engine not ready — skip this tick */
      }
    };
    roll();
    const id = setInterval(roll, SUGGESTION_MS);
    return () => clearInterval(id);
  }, []);

  function insert(token) {
    const sep = activeValue && !/\s$/.test(activeValue) ? ", " : "";
    setActiveValue(`${activeValue}${sep}${token}`);
  }

  // --- Building-block hover tooltip (label + description + a refreshing example) ---
  const showTip = (item, e) =>
    setTip({
      token: item.token,
      label: item.label,
      description: item.description,
      x: e.clientX,
      y: e.clientY,
    });
  const moveTip = (e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const hideTip = () => setTip(null);

  // While a tip is shown, expand its token into a fresh example, re-rolling on an interval.
  // Examples are rendered WITHOUT the auto fx/artists framing so they show just the block.
  const tipToken = tip?.token;
  useEffect(() => {
    if (!tipToken) {
      setTipEx("");
      return undefined;
    }
    const roll = () => {
      try {
        setTipEx(
          expandPrompt(tipToken, {
            ...settingsRef.current,
            autoAddFx: false,
            autoAddArtists: false,
          }),
        );
      } catch {
        setTipEx("");
      }
    };
    roll();
    const id = setInterval(roll, 1400);
    return () => clearInterval(id);
  }, [tipToken]);

  // Random drops the currently-shown suggestion into the prompt box.
  function useSuggestion() {
    if (suggestion) setPrompt(suggestion);
  }

  // Generate from whatever is typed; if the box is empty, fall back to the
  // current suggestion (or a fresh random roll) so it's never a no-op.
  function buildPrompts() {
    setError("");
    try {
      // Frame each prompt with the active wrapper (start, your prompt, end) — the v3 root layer.
      // The wrapper boxes are DPL, so render them (probability/bullets) per prompt before joining.
      const text = prompt && prompt.trim() ? prompt : suggestion || "{#random-words}";
      // The Default wrapper is read live (so edits to it apply); a chosen named/None wrapper uses
      // its stored snapshot.
      const w =
        !settings.wrapperName || settings.wrapperName === "Default"
          ? getDefaultWrapper()
          : (settings.wrapper ?? getDefaultWrapper());
      const count = Math.max(1, Number(settings.promptCount) || 1);
      // Whether blocks may contribute their own `Auto Begin` / `Auto End` framing (default on). When
      // off, only the user wrapper (or None) frames the prompt — no input from any block.
      const useAuto = settings.useAutoSections !== false;
      const out = [];
      for (let i = 0; i < count; i++) {
        const wrapped = [
          renderWrapperPart(w.start, settings),
          text,
          renderWrapperPart(w.end, settings),
        ]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(", ");
        const sink = { begin: [], end: [] };
        // mode comes from the active provider's dialect (provider owns the dialect).
        const result = generatePrompt({
          ...settings,
          mode: flat.mode,
          prompt: wrapped,
          autoSink: useAuto ? sink : null,
        });
        // Fold each fired block's Auto Begin / Auto End into the prompt's start / end.
        const framed = useAuto
          ? [sink.begin.join(", "), result, sink.end.join(", ")]
              .map((s) => s.trim())
              .filter(Boolean)
              .join(", ")
          : result;
        out.push({ id: nextId(), text: framed, dpl: text, batches: [] });
      }
      // A new roll ADDS to the list, newest on top (Clear all / per-prompt clear to remove).
      setPrompts((prev) => [...out, ...prev]);
      // Auto-render: kick off an image batch for each new prompt (api providers only). If the chosen
      // provider is safe-for-work-only and NSFW mode is on, ask once before sending — never block the
      // prompt build, and never tell the user it's disallowed.
      const nsfwOk =
        !softLockedForNsfw(provider, settings.includeAdult) ||
        confirm(intl.formatMessage(msgs.nsfwProceed, { provider: provider?.label }));
      if (canGenerateImages && nsfwOk) out.forEach((p) => makeBatch(p.id, p.text, p.dpl));
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // Opening Share builds a fresh link so it's ready to copy; the link stays
  // visible even if the clipboard is blocked.
  function toggleShare() {
    if (panel === "share") {
      setPanel("");
    } else {
      setShareLink(shareUrl(settings));
      setPanel("share");
    }
  }
  async function copyLink(url = shareLink) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // leave the link visible for manual copy
    }
  }

  // Copy the prompt. For a syntax/plain provider (e.g. Midjourney) copy the FORMATTED prompt
  // (with the provider's --params), which is the whole point of the syntax tier.
  function copyPrompt(p) {
    const text = provider?.tier !== "api" && providerFmt ? providerFmt(p, flat) : p;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  // Filter blocks by the single search box (matches token or label). Category pills
  // (the Lists folder headers) are kept only when a following entry survives.
  const q = query.trim().toLowerCase();
  const matchItem = (i) =>
    (i.token || "").toLowerCase().includes(q) || (i.label || "").toLowerCase().includes(q);
  function filterItems(items) {
    if (!q) return items;
    const out = [];
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      if (i.category) {
        let any = false;
        for (let j = k + 1; j < items.length && !items[j].category; j++)
          if (matchItem(items[j])) {
            any = true;
            break;
          }
        if (any) out.push(i);
      } else if (matchItem(i)) {
        out.push(i);
      }
    }
    return out;
  }
  const effItems = (b) => b.items;
  const filtered = blocks
    .map((b) => ({ ...b, items: filterItems(effItems(b)) }))
    .filter((b) => b.items.some((i) => !i.category));

  // The active top group (Blocks / Lists), falling back to the first available.
  const active = filtered.find((b) => b.title === activeCat) || filtered[0] || null;
  const searching = !!q;
  // Folder sub-categories of the active group, and the currently-selected one (default All).
  const subCats = active ? foldersOf(active) : [];
  const effSub =
    activeSub === "All" || subCats.some((c) => c.label === activeSub) ? activeSub : "All";

  // The chips to render. Searching → the flat matched run. All → every chip across folders, plus
  // the insertable group pills (the plain folder headers are sub-tabs now, so they're dropped). A
  // folder sub-tab → that folder's chips, led by its whole-group insert pill when it has one.
  let activeItems;
  if (searching) {
    activeItems = active ? active.items.filter((i) => !i.category) : [];
  } else if (effSub === "All") {
    // All = every category shown with its pill header + buttons (special/any included as pills).
    activeItems = active ? active.items : [];
  } else {
    const cat = subCats.find((c) => c.label === effSub);
    activeItems = cat
      ? [
          ...(cat.token
            ? [{ category: true, token: cat.token, label: cat.label, description: cat.description }]
            : []),
          ...cat.items,
        ]
      : [];
  }

  return (
    <div className="workspace">
      {/* ---- Left panel: building-block palette ---- */}
      <aside className="sidebar">
        <div className="panel-head">
          <h3 className="panel-title">{intl.formatMessage(msgs.buildingBlocks)}</h3>
          <input
            className="picker-filter"
            placeholder={intl.formatMessage(msgs.searchBlocks)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="empty">{intl.formatMessage(msgs.noBlocks, { query })}</p>
        ) : (
          <>
            {/* Both groups (Blocks / Lists) are always listed, each with an "All" row and its folder
                sub-categories indented beneath it. The group header is a plain label; its "All" row
                carries the selection. Sub-tabs are hidden while searching (results go flat). */}
            <nav className="cat-tabs">
              {filtered.map((b) => {
                const isActiveGroup = !!active && active.title === b.title;
                const groupFolders = foldersOf(b);
                const selectGroup = () => {
                  setActiveCat(b.title);
                  setActiveSub("All");
                };
                return (
                  <Fragment key={b.title}>
                    <button className="cat-tab" onClick={selectGroup}>
                      <span className="cat-name">{b.title}</span>
                      <span className="count-pill">
                        {b.items.filter((i) => !i.category).length}
                      </span>
                    </button>
                    {!searching && (
                      <button
                        className={`cat-tab sub${isActiveGroup && effSub === "All" ? " on" : ""}`}
                        onClick={selectGroup}
                      >
                        <span className="cat-name">{intl.formatMessage(msgs.all)}</span>
                        <span className="count-pill">
                          {b.items.filter((i) => !i.category).length}
                        </span>
                      </button>
                    )}
                    {!searching &&
                      groupFolders.map((c) => (
                        <button
                          key={c.label}
                          className={`cat-tab sub${isActiveGroup && effSub === c.label ? " on" : ""}`}
                          onClick={() => {
                            setActiveCat(b.title);
                            setActiveSub(c.label);
                          }}
                          title={c.description || c.label}
                        >
                          <span className="cat-name">{c.label}</span>
                          <span className="count-pill">{c.items.length}</span>
                        </button>
                      ))}
                  </Fragment>
                );
              })}
            </nav>

            <div className="chip-area">
              {active && active.hint && !searching && effSub === "All" && (
                <p className="cat-hint">{active.hint}</p>
              )}
              <div className="picker-list">
                {activeItems.slice(0, 400).map((i, idx) =>
                  i.category ? (
                    i.token ? (
                      <button
                        key={`cat-${i.label}-${idx}`}
                        className="cat-pill cat-pill-group"
                        onMouseEnter={(e) => showTip(i, e)}
                        onMouseMove={moveTip}
                        onMouseLeave={hideTip}
                        onClick={() => insert(i.token)}
                      >
                        {i.label}
                      </button>
                    ) : (
                      <span
                        key={`cat-${i.label}-${idx}`}
                        className="cat-pill"
                        title={i.description || i.label}
                      >
                        {i.label}
                      </span>
                    )
                  ) : (
                    <button
                      key={i.token}
                      className="chip"
                      onMouseEnter={(e) => showTip(i, e)}
                      onMouseMove={moveTip}
                      onMouseLeave={hideTip}
                      onClick={() => insert(i.token)}
                    >
                      {i.label}
                    </button>
                  ),
                )}
                {activeItems.length > 400 && (
                  <span className="picker-more">
                    {intl.formatMessage(msgs.moreFilter, { count: activeItems.length - 400 })}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ---- Right pane: composer ---- */}
      <div className="main-col">
        <section className="card composer">
          {/* The prompt box is a chat-style field: a textarea with the actions
              docked along its bottom edge. */}
          <div className="compose-toolbar">
            <DplInsertBar editorRef={promptEditorRef} settings={settings} />
            {supportsNegative && (
              <div
                className="compose-mode"
                role="tablist"
                aria-label={intl.formatMessage(msgs.composeModeAria)}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={editMode === "prompt"}
                  className={`cm-tab${editMode === "prompt" ? " on" : ""}`}
                  onClick={() => setComposeMode("prompt")}
                >
                  {intl.formatMessage(msgs.tabPrompt)}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={editMode === "negative"}
                  className={`cm-tab${editMode === "negative" ? " on" : ""}`}
                  onClick={() => setComposeMode("negative")}
                >
                  {intl.formatMessage(msgs.tabNegative)}
                </button>
              </div>
            )}
          </div>
          <div className="composer-field">
            <DplEditor
              ref={promptEditorRef}
              className="prompt-input"
              value={activeValue}
              onChange={setActiveValue}
              settings={settings}
              ariaLabel={intl.formatMessage(editMode === "negative" ? msgs.ariaNegative : msgs.ariaPrompt)}
              placeholder={
                editMode === "negative"
                  ? intl.formatMessage(msgs.phNegative)
                  : suggestion
                    ? intl.formatMessage(msgs.phTry, { suggestion })
                    : intl.formatMessage(msgs.phPrompt)
              }
            />
            <div className="composer-corner">
              {activeValue && (
                <button
                  className="clear-x"
                  onClick={() => setActiveValue("")}
                  title={intl.formatMessage(editMode === "negative" ? msgs.clearNegative : msgs.clearPrompt)}
                  aria-label={intl.formatMessage(editMode === "negative" ? msgs.clearNegative : msgs.clearPrompt)}
                >
                  ✕
                </button>
              )}
              {/* Live preview lives in the box's upper-right corner (icon-only). */}
              <LivePreview
                getDpl={() =>
                  editMode === "negative"
                    ? activeValue || ""
                    : activeValue && activeValue.trim()
                      ? activeValue
                      : suggestion || "{#random-words}"
                }
                settings={settings}
                label={intl.formatMessage(editMode === "negative" ? msgs.negativePreview : msgs.promptPreview)}
                triggerClassName="preview-corner"
              />
              {/* Live DPL validity — between the preview and the gear; ✓ clean, ✕ on errors. */}
              <DplStatus value={activeValue || ""} className="status-corner" />
              {/* Prompt-settings gear — sits in the corner cluster, to the right of the preview. */}
              <div className="field-menu-wrap prompt-settings-gear">
                <button
                  className={`gear-corner${menuOpen ? " on" : ""}`}
                  onClick={() => setMenuOpen((o) => !o)}
                  title={intl.formatMessage(msgs.promptSettings)}
                  aria-label={intl.formatMessage(msgs.promptSettings)}
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                >
                  <GearIcon />
                </button>
                {menuOpen && (
                  <>
                    <div className="gear-pop-scrim" onClick={() => setMenuOpen(false)} />
                    <div className="gear-pop" role="dialog" aria-label={intl.formatMessage(msgs.promptSettings)}>
                      <div className="gear-pop-head">
                        <span>{intl.formatMessage(msgs.promptSettings)}</span>
                        <button className="link-btn" onClick={() => setMenuOpen(false)}>
                          {intl.formatMessage(msgs.close)}
                        </button>
                      </div>
                      <div className="gear-pop-body">
                        <Settings settings={settings} setSettings={setSettings} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="field-bar">
              <div className="prompt-tools">
                <label className="field-count" title={intl.formatMessage(msgs.promptsPerRunTitle)}>
                  <span className="field-count-label">{intl.formatMessage(msgs.promptsLabel)}</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.promptCount}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        promptCount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    aria-label={intl.formatMessage(msgs.promptsPerRunAria)}
                  />
                </label>

                {/* The active image provider's common knobs (Images + Size), when it has them. */}
                <InlineImageControls settings={settings} setSettings={setSettings} />
              </div>

              <div className="grow" />

              {/* Auto-fix + keyword-translate stay visible always; disabled with a hint when no
                  Text provider is selected (chosen in the header Providers dropdown). */}
              <button
                className={`field-act${hasRewrite && settings.autoFix ? " on" : ""}`}
                onClick={() => setSettings({ ...settings, autoFix: !settings.autoFix })}
                disabled={!hasRewrite}
                title={
                  hasRewrite
                    ? intl.formatMessage(msgs.autoFixOn, { provider: rewriteLabel })
                    : intl.formatMessage(msgs.autoFixOff)
                }
                aria-pressed={hasRewrite && !!settings.autoFix}
                aria-label={intl.formatMessage(msgs.autoFixAria)}
              >
                <WandIcon />
              </button>
              <button
                className={`field-act${hasRewrite && settings.autoKeyword ? " on" : ""}`}
                onClick={() => setSettings({ ...settings, autoKeyword: !settings.autoKeyword })}
                disabled={!hasRewrite}
                title={
                  hasRewrite
                    ? intl.formatMessage(msgs.keywordOn, { provider: rewriteLabel })
                    : intl.formatMessage(msgs.keywordOff)
                }
                aria-pressed={hasRewrite && !!settings.autoKeyword}
                aria-label={intl.formatMessage(msgs.keywordAria)}
              >
                <TagIcon />
              </button>
              <WrapperButton settings={settings} setSettings={setSettings} />
              <button
                className={`field-act${panel === "share" ? " on" : ""}`}
                onClick={toggleShare}
                title={intl.formatMessage(msgs.shareLink)}
                aria-label={intl.formatMessage(msgs.shareLink)}
                aria-pressed={panel === "share"}
              >
                <ShareIcon />
              </button>
              <button
                className="field-act"
                onClick={useSuggestion}
                disabled={!suggestion}
                title={intl.formatMessage(msgs.randomTitle)}
                aria-label={intl.formatMessage(msgs.randomAria)}
              >
                <ShuffleIcon />
              </button>
              <button
                className="field-act primary"
                onClick={buildPrompts}
                title={intl.formatMessage(msgs.generateTitle, { count: settings.promptCount })}
                aria-label={intl.formatMessage(msgs.generateAria)}
              >
                <SparkleIcon />
              </button>
            </div>
          </div>

          {/* Share panel, opened from the field bar */}
          {panel === "share" && (
            <div className="action-panel">
              <div className="ap-row">
                <i className="panel-icon" aria-hidden="true">
                  <ShareIcon />
                </i>
                <input
                  className="panel-input"
                  readOnly
                  value={shareLink}
                  onFocus={(e) => e.target.select()}
                  aria-label={intl.formatMessage(msgs.shareInputAria)}
                />
                <button className="primary" onClick={() => copyLink()}>
                  {intl.formatMessage(copied ? msgs.copied : msgs.copy)}
                </button>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        {imgError && <p className="error">{imgError}</p>}
        {prompts.length > 0 && (
          <section className="card results-card">
            <div className="results-head">
              <h2>{intl.formatMessage(msgs.promptsHeading)}</h2>
              <div className="results-head-right">
                <span className="count">
                  {intl.formatMessage(msgs.generatedCount, {
                    count: prompts.length,
                    provider: provider?.label,
                  })}
                </span>
                <button className="link-btn" onClick={clearAll} title={intl.formatMessage(msgs.clearAllTitle)}>
                  {intl.formatMessage(msgs.clearAll)}
                </button>
              </div>
            </div>
            <ul className="prompts">
              {prompts.map((p, i) => (
                <PromptResult
                  key={p.id}
                  prompt={p}
                  index={i}
                  number={prompts.length - i}
                  settings={settings}
                  canGenerate={canGenerateImages}
                  onGenerate={makeBatch}
                  onCopy={copyPrompt}
                  onRemoveImage={removeImage}
                  onRemoveBatch={removeBatch}
                  onClearImages={clearImages}
                  onImageClick={onOpenImage}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Hover tooltip for a building block — follows the pointer; shows a live, refreshing example.
          Flips above the cursor when there isn't room below so it can't clip off the bottom. */}
      {tip && (
        <div
          className="block-tip"
          style={(() => {
            const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
            const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
            const left = Math.max(8, Math.min(tip.x + 16, vw - 360));
            // If the pointer is in the lower part of the screen, anchor the tip's bottom above it.
            return tip.y > vh * 0.6
              ? { left, bottom: vh - tip.y + 18, maxHeight: tip.y - 16 }
              : { left, top: tip.y + 18, maxHeight: vh - tip.y - 28 };
          })()}
          role="tooltip"
        >
          <div className="block-tip-name">
            <span className="block-tip-label">{tip.label}</span>
            <code className="block-tip-token">{tip.token}</code>
          </div>
          {tip.description && <div className="block-tip-desc">{tip.description}</div>}
          {tipEx && (
            <div className="block-tip-ex">
              <span className="block-tip-ex-label">{intl.formatMessage(msgs.example)}</span> {tipEx}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
