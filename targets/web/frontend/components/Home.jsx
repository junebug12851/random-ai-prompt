/**
 * The Home composer — a focused two-pane prompt workspace. The left pane is the
 * building-block cloud (keywords, lists, expansions, blocks); the right
 * pane hosts the reusable {@link PromptComposer} prompt box (with all its bells and
 * whistles) above the generated-prompt list.
 *
 * Image generation is back (per the active provider: api-tier renders into the Gallery;
 * the syntax tier copies a formatted prompt). Still removed (see
 * notes/plans/removed-pending-readd.md): presets and the Normal/Anime style toggle (the anime
 * word lists mix SFW + explicit adult tags and need a proper split first).
 * @module gui/components/Home
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { generatePrompt, renderWrapperPart, expandPrompt } from "../lib/promptEngine.js";
import { shouldReflectSeed } from "../lib/home/seed.js";
import { buildRoll } from "../lib/home/buildRoll.js";
import { getDefaultWrapper } from "../lib/wrapperStore.js";
import { getProvider } from "../lib/providers/index.js";
import { flattenForProvider } from "../lib/useProvider.js";
import { softLockedForNsfw } from "../lib/contentPolicy.js";
import { dialog } from "../lib/dialog.js";
import PromptComposer from "./PromptComposer.jsx";
import PromptResult from "./PromptResult.jsx";
import BlockPalette from "./home/BlockPalette.jsx";
import { BlocksIcon, TrashIcon } from "./icons.jsx";
import { useImageBatches } from "../lib/home/useImageBatches.js";

const msgs = defineMessages({
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
  openBlocks: { id: "home.openBlocks", defaultMessage: "Building blocks" },
  openBlocksAria: { id: "home.openBlocksAria", defaultMessage: "Open building blocks" },
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
  const [paletteOpen, setPaletteOpen] = useState(false); // phone: building-block drawer open?
  // Hover tooltip for a building block: its label, description (piped from the v3 file /
  // sidecar), and a LIVE example output that re-rolls while the pointer rests on the chip.
  const [tip, setTip] = useState(null); // { token, label, description, x, y }
  const [tipEx, setTipEx] = useState("");
  const composerRef = useRef(null); // the PromptComposer — palette inserts reach its active editor

  // --- Active image provider (selection lives in settings; knobs are per-provider) ---
  const provider = getProvider(settings.provider);
  const [providerFmt, setProviderFmt] = useState(null); // syntax/plain tier: prompt formatter
  const [providerDefaults, setProviderDefaults] = useState({});

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

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Phone: dismiss the building-block drawer on Escape (the scrim handles tap-away). Client-only,
  // so it never runs during the prerender.
  useEffect(() => {
    if (!paletteOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setPaletteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  // The palette inserts a building block into the composer's active editor (prompt or negative).
  function insert(token) {
    composerRef.current?.insert(token);
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

  // Generate from the effective prompt text (supplied by the composer). Frame each prompt with the
  // active wrapper, roll the batch, and auto-fire an image batch per prompt (api providers only).
  // Errors propagate to the composer, which surfaces them inline.
  async function buildPrompts(text) {
    const w =
      !settings.wrapperName || settings.wrapperName === "Default"
        ? getDefaultWrapper()
        : (settings.wrapper ?? getDefaultWrapper());
    const { prompts: out, rollSeed } = buildRoll({
      settings,
      text,
      wrapper: w,
      mode: flat.mode,
      deps: { renderWrapperPart, generatePrompt, nextId },
    });
    // A new roll ADDS to the list, newest on top (Clear all / per-prompt clear to remove).
    setPrompts((prev) => [...out, ...prev]);
    if (shouldReflectSeed(settings, rollSeed)) setSettings({ ...settings, promptSeed: rollSeed });
    // Auto-render: kick off an image batch for each new prompt (api providers only). If the chosen
    // provider is safe-for-work-only and NSFW mode is on, ask once before sending.
    const nsfwOk =
      !softLockedForNsfw(provider, settings.includeAdult) ||
      (await dialog.confirm({
        message: intl.formatMessage(msgs.nsfwProceed, { provider: provider?.label }),
      }));
    if (canGenerateImages && nsfwOk) out.forEach((p) => makeBatch(p.id, p.text, p.dpl));
  }

  // Copy the prompt. For a syntax/plain provider (e.g. Midjourney) copy the FORMATTED prompt
  // (with the provider's --params), which is the whole point of the syntax tier.
  function copyPrompt(p) {
    const text = provider?.tier !== "api" && providerFmt ? providerFmt(p, flat) : p;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className={`workspace home${paletteOpen ? " palette-open" : ""}`}>
      {/* ---- Left panel: building-block palette ----
          On phone this pane is an off-canvas drawer (CSS): the scrim + the "Building blocks" trigger
          below are phone-only; on wider screens the pane is always visible and they're hidden. */}
      <BlockPalette
        includeAdult={settings.includeAdult}
        onInsert={insert}
        onShowTip={showTip}
        onMoveTip={moveTip}
        onHideTip={hideTip}
        onClose={() => setPaletteOpen(false)}
      />
      <div className="palette-scrim" onClick={() => setPaletteOpen(false)} aria-hidden="true" />
      {/* Compact-only (CSS): a small icon FAB in the bottom-left corner that opens the
          building-block drawer. */}
      <button
        type="button"
        className="palette-trigger"
        onClick={() => setPaletteOpen(true)}
        aria-controls="block-palette"
        aria-expanded={paletteOpen}
        aria-label={intl.formatMessage(msgs.openBlocksAria)}
        title={intl.formatMessage(msgs.openBlocks)}
      >
        <BlocksIcon />
      </button>

      {/* ---- Right pane: composer ---- */}
      <div className="main-col">
        <PromptComposer
          ref={composerRef}
          settings={settings}
          setSettings={setSettings}
          onGenerate={buildPrompts}
        />

        {imgError && (
          <p className="error" role="alert">
            {imgError}
          </p>
        )}
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
                <button
                  className="clear-all-btn"
                  onClick={clearAll}
                  title={intl.formatMessage(msgs.clearAllTitle)}
                  aria-label={intl.formatMessage(msgs.clearAll)}
                >
                  <TrashIcon />
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
