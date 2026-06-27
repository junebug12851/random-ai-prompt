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
import { useEffect, useMemo, useRef, useState } from "react";
import { getBlocks, generatePrompt, renderWrapperPart, expandPrompt } from "../lib/promptEngine.js";
import { getDefaultWrapper } from "../lib/wrapperStore.js";
import { shareUrl } from "../lib/share.js";
import { getProvider } from "../lib/providers/index.js";
import { flattenForProvider } from "../lib/useProvider.js";
import { ingestImage, isOutputFile, deleteImageFile } from "../lib/output.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { rewritePrompt } from "../lib/rewrite.js";
import WrapperButton from "./WrapperFab.jsx";
import ProviderBox from "./ProviderBox.jsx";
import PromptResult from "./PromptResult.jsx";
import Settings from "./Settings.jsx";
import LivePreview from "./LivePreview.jsx";

const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes

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
const GearIcon = () => (
  <svg {...ico} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * The compose workspace.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Home({ settings, setSettings }) {
  const [version, setVersion] = useState(0); // bump to refresh custom blocks
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [panel, setPanel] = useState(""); // "" | "save" | "share"
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // prompt-settings gear popover
  // Hover tooltip for a building block: its label, description (piped from the v3 file /
  // sidecar), and a LIVE example output that re-rolls while the pointer rests on the chip.
  const [tip, setTip] = useState(null); // { token, label, description, x, y }
  const [tipEx, setTipEx] = useState("");

  const blocks = useMemo(() => getBlocks(), [version]);

  // --- Active image provider (selection lives in settings; knobs are per-provider) ---
  const provider = getProvider(settings.provider);
  const [providerFmt, setProviderFmt] = useState(null); // syntax/plain tier: prompt formatter
  const [providerDefaults, setProviderDefaults] = useState({});
  const [imgError, setImgError] = useState("");
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;

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
      const useFix =
        settings.autoFix && settings.rewriteProvider && settings.rewriteProvider !== "none";
      const rkey = useFix ? effectiveKey(settings.rewriteProvider, settings) : "";
      if (useFix && !rkey) {
        setImgError("Auto-fix is on but the rewrite provider has no API key (gear → Auto-fix).");
      }

      // --- Main prompt: auto-fix once per prompt, then cache the mapping on the entry. ---
      if (useFix && rkey && !entry0?.original) {
        try {
          const fixed = await rewritePrompt({
            providerId: settings.rewriteProvider,
            prompt: text,
            key: rkey,
          });
          if (fixed && fixed.trim()) {
            promptRoll = text;
            text = fixed.trim();
            promptAi = text;
            setPrompts((ps) =>
              ps.map((x) => (x.id === promptId ? { ...x, original: promptRoll, text } : x)),
            );
          }
        } catch (e) {
          setImgError("Auto-fix failed: " + (e.message || e));
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
      } else if (useFix && rkey && negRoll.trim()) {
        try {
          const fixedNeg = await rewritePrompt({
            providerId: settings.rewriteProvider,
            prompt: negRoll,
            key: rkey,
          });
          if (fixedNeg && fixedNeg.trim()) negAi = fixedNeg.trim();
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
      // (read back by the photo gallery). The settings snapshot drops API keys — never to disk.
      const { keys: _keys, ...settingsSnapshot } = { ...flat, negativePrompt: negFinal };
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
      confirm(
        "Delete this image from disk too?\n\nOK = delete the file\nCancel = just remove it from view",
      )
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
    if (imgs.some(isOutputFile) && confirm("Delete this batch's image files from disk too?")) {
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
      confirm("Delete all of this prompt's image files from disk too?")
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
      confirm(`Clear all results — delete their ${imgs.length} image file(s) from disk too?`)
    ) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts([]);
  }

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });

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
    const sep = prompt && !/\s$/.test(prompt) ? ", " : "";
    setPrompt(`${prompt}${sep}${token}`);
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
      // Auto-render: kick off an image batch for each new prompt (api providers only).
      if (canGenerateImages) out.forEach((p) => makeBatch(p.id, p.text, p.dpl));
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

  // The active category (falls back to the first available when the current
  // selection is filtered away or unset).
  const active = filtered.find((b) => b.title === activeCat) || filtered[0] || null;
  const activeItems = active ? active.items : [];

  return (
    <div className="workspace">
      {/* ---- Left panel: building-block palette ---- */}
      <aside className="sidebar">
        <div className="panel-head">
          <h3 className="panel-title">Building blocks</h3>
          <input
            className="picker-filter"
            placeholder="Search blocks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="empty">No building blocks match “{query}”.</p>
        ) : (
          <>
            <nav className="cat-tabs">
              {filtered.map((b) => (
                <button
                  key={b.title}
                  className={`cat-tab${active && active.title === b.title ? " on" : ""}`}
                  onClick={() => setActiveCat(b.title)}
                >
                  <span className="cat-name">{b.title}</span>
                  <span className="count-pill">{b.items.filter((i) => !i.category).length}</span>
                </button>
              ))}
            </nav>

            <div className="chip-area">
              {active && active.hint && <p className="cat-hint">{active.hint}</p>}
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
                    +{activeItems.length - 400} more — keep typing to filter
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ---- Right pane: composer ---- */}
      <div className="main-col">
        <ProviderBox settings={settings} setSettings={setSettings} />

        <section className="card composer">
          {/* The prompt box is a chat-style field: a textarea with the actions
              docked along its bottom edge. */}
          <div className="composer-field">
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                suggestion
                  ? `Try: ${suggestion}`
                  : "Type a prompt, or use the building blocks on the left…"
              }
            />
            {prompt && (
              <button
                className="clear-x"
                onClick={() => setPrompt("")}
                title="Clear the prompt"
                aria-label="Clear the prompt"
              >
                ✕
              </button>
            )}

            <div className="field-bar">
              <div className="prompt-tools">
                <label className="field-count" title="Prompts per run">
                  <span className="field-count-label">count</span>
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
                    aria-label="Prompts per run"
                  />
                </label>

                <div className="field-menu-wrap">
                  <button
                    className={`field-act${menuOpen ? " on" : ""}`}
                    onClick={() => setMenuOpen((o) => !o)}
                    title="Prompt settings"
                    aria-label="Prompt settings"
                    aria-pressed={menuOpen}
                  >
                    <GearIcon />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="gear-pop-scrim" onClick={() => setMenuOpen(false)} />
                      <div className="gear-pop" role="dialog" aria-label="Prompt settings">
                        <div className="gear-pop-head">
                          <span>Prompt settings</span>
                          <button className="link-btn" onClick={() => setMenuOpen(false)}>
                            close
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

              <div className="grow" />

              {settings.rewriteProvider && settings.rewriteProvider !== "none" && (
                <button
                  className={`field-act${settings.autoFix ? " on" : ""}`}
                  onClick={() => setSettings({ ...settings, autoFix: !settings.autoFix })}
                  title={`Auto-fix the prompt with ${getProvider(settings.rewriteProvider)?.label || "AI"} before generating`}
                  aria-pressed={!!settings.autoFix}
                  aria-label="Auto-fix prompt"
                >
                  <WandIcon />
                </button>
              )}
              <LivePreview
                getDpl={() => (prompt && prompt.trim() ? prompt : suggestion || "{#random-words}")}
                settings={settings}
                label="Prompt preview"
                triggerClassName="field-act"
              />
              <WrapperButton settings={settings} setSettings={setSettings} />
              <button
                className={`field-act${panel === "share" ? " on" : ""}`}
                onClick={toggleShare}
                title="Share link"
                aria-label="Share link"
                aria-pressed={panel === "share"}
              >
                <ShareIcon />
              </button>
              <button
                className="field-act"
                onClick={useSuggestion}
                disabled={!suggestion}
                title="Random — drop a suggestion in"
                aria-label="Random suggestion"
              >
                <ShuffleIcon />
              </button>
              <button
                className="field-act primary"
                onClick={buildPrompts}
                title={`Generate prompt${settings.promptCount > 1 ? "s" : ""}`}
                aria-label="Generate prompt"
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
                  aria-label="Shareable link that restores these settings"
                />
                <button className="primary" onClick={() => copyLink()}>
                  {copied ? "✓ Copied" : "Copy"}
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
              <h2>Prompts</h2>
              <div className="results-head-right">
                <span className="count">
                  {prompts.length} generated · {provider?.label}
                </span>
                <button className="link-btn" onClick={clearAll} title="Clear all results">
                  Clear all
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
                  canGenerate={canGenerateImages}
                  onGenerate={makeBatch}
                  onCopy={copyPrompt}
                  onRemoveImage={removeImage}
                  onRemoveBatch={removeBatch}
                  onClearImages={clearImages}
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
              <span className="block-tip-ex-label">Example:</span> {tipEx}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
