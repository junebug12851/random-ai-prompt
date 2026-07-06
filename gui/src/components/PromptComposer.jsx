/**
 * The reusable prompt-box composer — the DPL prompt field plus all its bells and whistles: the DPL
 * insert toolbar, the Prompt/Negative switch (when the provider supports negatives), the editor with
 * its corner cluster (live DPL status, clear, live preview, and a prompt-settings gear), and the
 * action bar (prompts-per-run, inline image controls, auto-fix, keyword-translate, wrapper, share,
 * random, and generate). It also carries a rotating random suggestion and an inline share panel.
 *
 * It is deliberately provider- and view-agnostic: it reads/writes only `settings` and calls back an
 * `onGenerate(text)` supplied by the parent. That lets it serve BOTH the Home composer (which turns a
 * generate into a prompt list + image batches) and a compact copy atop the Gallery (which streams
 * live placeholders into the grid) with no duplicated UI. The parent's building-block palette reaches
 * the active editor through the imperative `insert(token)` handle exposed on the ref.
 * @module gui/components/PromptComposer
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { expandPrompt } from "../lib/promptEngine.js";
import { shareUrl } from "../lib/share.js";
import { getProvider } from "../lib/providers/index.js";
import WrapperButton from "./WrapperFab.jsx";
import Settings from "./Settings.jsx";
import InlineImageControls from "./InlineImageControls.jsx";
import LivePreview from "./LivePreview.jsx";
import DplEditor from "./DplEditor.jsx";
import DplInsertBar from "./DplInsertBar.jsx";
import DplStatus from "./DplStatus.jsx";
import { ShareIcon, ShuffleIcon, SparkleIcon, WandIcon, TagIcon, GearIcon } from "./icons.jsx";

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
  generating: { id: "home.composerGenerating", defaultMessage: "Generating…" },
});

/**
 * The reusable prompt-box composer.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @param {Function} props.onGenerate `(text) => Promise|void` — run a generation for the effective
 *   prompt text (the typed prompt, or the current random suggestion when the box is empty).
 * @param {boolean} [props.compact] Render the narrower variant (used atop the Gallery).
 * @param {import('react').Ref} ref Exposes `insert(token)` (append a building block to the active
 *   editor) and `focus()`.
 * @returns {JSX.Element}
 */
function PromptComposer({ settings, setSettings, onGenerate, compact = false }, ref) {
  const intl = useIntl();
  const [suggestion, setSuggestion] = useState("");
  const [panel, setPanel] = useState(""); // "" | "share"
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // prompt-settings gear popover
  const [composeMode, setComposeMode] = useState("prompt"); // "prompt" | "negative"
  const [error, setError] = useState("");
  const [status, setStatus] = useState(""); // sr-only live-region announcement
  const promptEditorRef = useRef(null);

  const provider = getProvider(settings.provider);
  const pid = provider?.id;
  const supportsNegative = !!provider?.capabilities?.negativePrompt;
  const rewriteProv =
    settings.rewriteProvider && settings.rewriteProvider !== "none"
      ? getProvider(settings.rewriteProvider)
      : null;
  const rewriteLabel =
    rewriteProv?.rewriteLabel || rewriteProv?.label || intl.formatMessage(msgs.aiFallback);
  const hasRewrite = !!rewriteProv;

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });

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

  // A rotating random prompt suggestion. The latest settings live in a ref so the interval reads
  // current word lists without resetting its timer on every keystroke.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const roll = () => {
      try {
        setSuggestion(expandPrompt("{#random-words}", settingsRef.current));
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

  // No deps array on purpose: the handle is recreated each render so `insert` always closes over the
  // current active value / mode (cheap — it's just an object of two closures).
  useImperativeHandle(ref, () => ({
    insert,
    focus: () => promptEditorRef.current?.focus?.(),
  }));

  // Random drops the currently-shown suggestion into the prompt box.
  function useSuggestion() {
    if (suggestion) setPrompt(suggestion);
  }

  // Generate from whatever is typed; if the box is empty, fall back to the current suggestion (or a
  // fresh random roll) so it's never a no-op. Errors surface inline; success announces politely.
  async function generate() {
    setError("");
    const text = prompt && prompt.trim() ? prompt : suggestion || "{#random-words}";
    try {
      setStatus(intl.formatMessage(msgs.generating));
      await onGenerate?.(text);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setStatus("");
    }
  }

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
      setCopied(false);
    }
  }

  return (
    <section className={`card composer${compact ? " compact" : ""}`}>
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

            <InlineImageControls settings={settings} setSettings={setSettings} />
          </div>

          <div className="grow" />

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
            onClick={generate}
            title={intl.formatMessage(msgs.generateTitle, { count: settings.promptCount })}
            aria-label={intl.formatMessage(msgs.generateAria)}
          >
            <SparkleIcon />
          </button>
        </div>
      </div>

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

      {/* Polite live region so screen readers hear that a generation started. */}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default forwardRef(PromptComposer);
