/**
 * The header **Providers** dropdown — one trigger that opens a small panel holding BOTH provider
 * choices stacked vertically, each a rich grouped picker with its BYOK key field on the right:
 *   • Image — what renders the picture, grouped Local (incl. Plain text) / Online.
 *   • Text  — the AI that rewrites the prompt & keywords (auto-fix); Off or one of the rewrite AIs.
 * This keeps the header lean (just this dropdown + the settings gear + the NSFW switch). The
 * image-provider's own knobs live in the gear popover next door (`ProviderGear`); the auto-fix /
 * keyword toggles stay on the prompt box. Keys are stored per provider id, so the same provider
 * chosen for both rows shares one key (shown once).
 * @module gui/components/ProvidersMenu
 */
import { useState } from "react";
import { providers, getProvider, rewriteProviders } from "../lib/providers/index.js";
import { ONLINE } from "../lib/online.js";
import { providerMode } from "../lib/useProvider.js";
import { metaFor } from "../lib/providerMeta.js";
import ProviderPicker from "./ProviderPicker.jsx";
import ApiKeyField from "./ApiKeyField.jsx";

/** Shape a provider config into a ProviderPicker option (with its description + key/lock badge). */
const toOption = (p) => ({
  id: p.id,
  label: p.label,
  needsKey: p.needsKey,
  description: metaFor(p.id).description,
  // Local providers need a machine, so the online build shows them disabled (greyed + linked).
  locked: ONLINE && p.local,
});

/**
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function ProvidersMenu({ settings, setSettings }) {
  const [open, setOpen] = useState(false);
  // Show every provider; local ones are rendered disabled (locked) in the online build rather
  // than hidden, so visitors can see what the full desktop version adds.
  const provs = providers;

  const imageId = settings.provider;
  const image = getProvider(imageId);
  const textId =
    settings.rewriteProvider && settings.rewriteProvider !== "none"
      ? settings.rewriteProvider
      : "none";
  const text = textId !== "none" ? getProvider(textId) : null;

  // Image providers grouped Local / Online. Plain text needs no machine or network, so it lists
  // under Local alongside the local Stable Diffusion engines.
  const imageGroups = [
    { title: "Local", items: provs.filter((p) => p.local || p.id === "plain").map(toOption) },
    { title: "Online", items: provs.filter((p) => !p.local && p.id !== "plain").map(toOption) },
  ];
  // Text providers: Off, then the rewrite-capable AIs.
  const textGroups = [
    {
      title: "Prompt & keyword rewrite",
      items: [
        { id: "none", label: "Off", description: "No prompt or keyword rewriting." },
        ...rewriteProviders().map(toOption),
      ],
    },
  ];

  const pickImage = (id) => setSettings((s) => ({ ...s, provider: id, mode: providerMode(id) }));
  const pickText = (id) => setSettings((s) => ({ ...s, rewriteProvider: id }));

  return (
    <div className="provider-select providers-menu">
      <button
        className="ps-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Providers"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="provider-select-label">Providers</span>
        <span className="ps-current">{image?.label}</span>
        <span className="ps-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="ps-scrim" onClick={() => setOpen(false)} />
          <div className="pm-pop" role="dialog" aria-label="Providers">
            <div className="pm-row">
              <ProviderPicker label="Image" value={imageId} groups={imageGroups} onPick={pickImage} />
              <ApiKeyField settings={settings} setSettings={setSettings} providerId={imageId} />
            </div>

            <div className="pm-row">
              <ProviderPicker label="Text" value={textId} groups={textGroups} onPick={pickText} />
              {/* Same provider for both rows already shares one key — show it once. */}
              {textId !== imageId ? (
                <ApiKeyField settings={settings} setSettings={setSettings} providerId={textId} />
              ) : (
                text?.needsKey && <span className="pm-shared">shares the image key</span>
              )}
            </div>

            <p className="pm-hint">
              {text
                ? "Text AI rewrites your prompt & keywords — turn it on per run with the wand / tag buttons on the prompt box."
                : "Pick a Text AI to enable auto-fix / keyword rewriting (toggled on the prompt box)."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
