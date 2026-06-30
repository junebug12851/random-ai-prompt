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
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { generatePrompt, renderWrapperPart, expandPrompt } from "../lib/promptEngine.js";
import { getDefaultWrapper } from "../lib/wrapperStore.js";
import { shareUrl } from "../lib/share.js";
import { getProvider } from "../lib/providers/index.js";
import { flattenForProvider } from "../lib/useProvider.js";
import { softLockedForNsfw } from "../lib/contentPolicy.js";
import WrapperButton from "./WrapperFab.jsx";
import PromptResult from "./PromptResult.jsx";
import Settings from "./Settings.jsx";
import InlineImageControls from "./InlineImageControls.jsx";
import LivePreview from "./LivePreview.jsx";
import DplEditor from "./DplEditor.jsx";
import DplInsertBar from "./DplInsertBar.jsx";
import DplStatus from "./DplStatus.jsx";
import BlockPalette from "./home/BlockPalette.jsx";
import { ShareIcon, ShuffleIcon, SparkleIcon, WandIcon, TagIcon, GearIcon } from "./icons.jsx";
import { useImageBatches } from "../lib/home/useImageBatches.js";

const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes

const msgs = defineMessages({
  aiFallback: { id: "home.aiFallback", defaultMessage: "AI" },
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

  // --- Active image provider (selection lives in settings; knobs are per-provider) ---
  // The image provider can be left Unset ("none") — then we generate prompts only, no images.
  const provider = settings.provider && settings.provider !== "none" ? getProvider(settings.provider) : null;
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
  const promptEditorRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const p = settings.provider && settings.provider !== "none" ? getProvider(settings.provider) : null;
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

  // The generated-prompt list and its image-batch lifecycle (run a batch + the rewrite passes,
  // and remove/clear images/batches/all) live in their own hook; Home just drives them.
  const {
    prompts,
    setPrompts,
    nextId,
    imgError,
    makeBatch,
    removeImage,
    removeBatch,
    clearImages,
    clearAll,
  } = useImageBatches({ settings, provider, flat });

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

  return (
    <div className="workspace">
      {/* ---- Left panel: building-block palette ---- */}
      <BlockPalette
        includeAdult={settings.includeAdult}
        onInsert={insert}
        onShowTip={showTip}
        onMoveTip={moveTip}
        onHideTip={hideTip}
      />

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
            {/* Live DPL validity — pinned to the box's upper-LEFT corner; ✓ clean, ✕ on errors. */}
            <div className="composer-corner-left">
              <DplStatus value={activeValue || ""} className="status-corner" />
            </div>
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
