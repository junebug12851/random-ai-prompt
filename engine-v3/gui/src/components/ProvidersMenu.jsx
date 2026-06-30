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
import { useIntl, defineMessages } from "react-intl";
import { providers, getProvider, rewriteProviders } from "../lib/providers/index.js";
import { softLockedForNsfw } from "../lib/contentPolicy.js";
import { ONLINE } from "../lib/online.js";
import { providerMode } from "../lib/useProvider.js";
import { metaFor } from "../lib/providerMeta.js";
import ProviderPicker from "./ProviderPicker.jsx";
import ApiKeyField from "./ApiKeyField.jsx";

const msgs = defineMessages({
  reasonProxy: {
    id: "providersMenu.reason.proxy",
    defaultMessage:
      "This provider can't be called directly from a browser, so it isn't available online.",
  },
  reasonLocal: {
    id: "providersMenu.reason.local",
    defaultMessage: "It runs on your own machine.",
  },
  providers: { id: "providersMenu.providers", defaultMessage: "Providers" },
  image: { id: "providersMenu.image", defaultMessage: "Image" },
  text: { id: "providersMenu.text", defaultMessage: "Text" },
  groupLocal: { id: "providersMenu.group.local", defaultMessage: "Local" },
  groupOnline: { id: "providersMenu.group.online", defaultMessage: "Online" },
  groupRewrite: {
    id: "providersMenu.group.rewrite",
    defaultMessage: "Prompt & keyword rewrite",
  },
  off: { id: "providersMenu.off", defaultMessage: "Off" },
  offDesc: { id: "providersMenu.offDesc", defaultMessage: "No prompt or keyword rewriting." },
  unset: { id: "providersMenu.unset", defaultMessage: "Unset" },
  unsetDesc: {
    id: "providersMenu.unsetDesc",
    defaultMessage: "No text AI selected — prompt & keyword rewriting stays off.",
  },
  unsetUpscaleDesc: {
    id: "providersMenu.unsetUpscaleDesc",
    defaultMessage: "No upscaler selected.",
  },
  sharesKey: { id: "providersMenu.sharesKey", defaultMessage: "shares the image key" },
  hintOn: {
    id: "providersMenu.hintOn",
    defaultMessage:
      "Text AI rewrites your prompt & keywords — turn it on per run with the wand / tag buttons on the prompt box.",
  },
  hintOff: {
    id: "providersMenu.hintOff",
    defaultMessage:
      "Pick a Text AI to enable auto-fix / keyword rewriting (toggled on the prompt box).",
  },
  upscale: { id: "providersMenu.upscale", defaultMessage: "Upscaler / Enhancer" },
  groupUpscale: { id: "providersMenu.group.upscale", defaultMessage: "Upscale / enhance" },
  groupUpscaleLocal: { id: "providersMenu.group.upscaleLocal", defaultMessage: "Local" },
  groupUpscaleOnline: { id: "providersMenu.group.upscaleOnline", defaultMessage: "Online" },
  upscaleHint: {
    id: "providersMenu.upscaleHint",
    defaultMessage:
      "Used in the single-image view to upscale a saved image. Pick a provider and add its key.",
  },
  upscaleLockedReason: {
    id: "providersMenu.upscaleLockedReason",
    defaultMessage:
      "Upscaling happens in the single-image view, which needs the full desktop app (it isn't available online).",
  },
});

/**
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function ProvidersMenu({ settings, setSettings }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  // Show every provider; local ones are rendered disabled (locked) in the online build rather
  // than hidden, so visitors can see what the full desktop version adds.
  const provs = providers;

  // Shape a provider config into a ProviderPicker option (with its description + key/lock badge).
  // Online is a static site: local-direct providers need the user's machine, and hosted-proxy
  // providers (Replicate / BFL / Ideogram) can't be called straight from a browser (no CORS).
  const toOption = (p) => {
    const lockedLocal = ONLINE && p.local;
    const lockedProxy = ONLINE && p.transport === "hosted-proxy";
    return {
      id: p.id,
      label: p.label,
      needsKey: p.needsKey,
      description: metaFor(p.id).description,
      // SFW-only provider while NSFW mode is on → a soft lock (icon + tooltip), still selectable.
      softLock: softLockedForNsfw(p, settings.includeAdult),
      locked: lockedLocal || lockedProxy,
      lockReason: lockedProxy
        ? intl.formatMessage(msgs.reasonProxy)
        : lockedLocal
          ? intl.formatMessage(msgs.reasonLocal)
          : undefined,
    };
  };

  const imageId = settings.provider;
  const image = getProvider(imageId);
  const textId =
    settings.rewriteProvider && settings.rewriteProvider !== "none"
      ? settings.rewriteProvider
      : "none";
  const text = textId !== "none" ? getProvider(textId) : null;

  // Image providers grouped Local / Online. Plain text needs no machine or network, so it lists
  // under Local alongside the local Stable Diffusion engines. Upscale-only providers (enhancers like
  // DeepAI) can't generate, so they're excluded here — they live in the Upscaler / Enhancer row.
  const notImageRole = (p) => p.upscaleOnly || p.textOnly; // enhancers + text-only providers
  // Plain text needs no machine/key/network, so it's the universal default — pin it to the very top
  // of the Local group, above the local Stable Diffusion engines.
  const localImage = provs
    .filter((p) => (p.local || p.id === "plain") && !notImageRole(p))
    .sort((a, b) => (a.id === "plain" ? -1 : b.id === "plain" ? 1 : 0));
  const imageGroups = [
    {
      title: intl.formatMessage(msgs.groupLocal),
      // Plain text is the universal default and is labeled "Unset" (its config) — pinned to the top.
      items: localImage.map(toOption),
    },
    {
      title: intl.formatMessage(msgs.groupOnline),
      items: provs.filter((p) => !p.local && p.id !== "plain" && !notImageRole(p)).map(toOption),
    },
  ];

  // Upscaler / Enhancer providers: anything that ships an upscale adapter (the in-repo image
  // providers that also upscale + the upscale-only enhancers). Local-only feature (the single view),
  // so this row is hidden in the online build. Selecting one is just for key entry + a default.
  const upscaleId =
    settings.upscaleProvider && settings.upscaleProvider !== "none" ? settings.upscaleProvider : "none";
  // Grouped Local / Online like the image picker. "Off" leads the Local group (no machine needed).
  const upscaleCapable = provs.filter((p) => p.capabilities?.upscale && p.loadUpscale);
  const upscaleGroups = [
    {
      title: intl.formatMessage(msgs.groupUpscaleLocal),
      items: [
        { id: "none", label: intl.formatMessage(msgs.unset), description: intl.formatMessage(msgs.unsetUpscaleDesc) },
        ...upscaleCapable.filter((p) => p.local).map(toOption),
      ],
    },
    {
      title: intl.formatMessage(msgs.groupUpscaleOnline),
      items: upscaleCapable.filter((p) => !p.local).map(toOption),
    },
  ];
  // Text providers: Off, then the rewrite-capable AIs. A provider in the text role uses its chat
  // model, so show its `rewriteLabel` (e.g. "OpenAI (GPT-4o mini)") instead of the image label.
  const toTextOption = (p) => ({ ...toOption(p), label: p.rewriteLabel || p.label });
  const textGroups = [
    {
      title: intl.formatMessage(msgs.groupRewrite),
      items: [
        {
          id: "none",
          label: intl.formatMessage(msgs.unset),
          description: intl.formatMessage(msgs.unsetDesc),
        },
        ...rewriteProviders().map(toTextOption),
      ],
    },
  ];

  const pickImage = (id) => setSettings((s) => ({ ...s, provider: id, mode: providerMode(id) }));
  const pickText = (id) => setSettings((s) => ({ ...s, rewriteProvider: id }));
  const pickUpscale = (id) => setSettings((s) => ({ ...s, upscaleProvider: id }));

  return (
    <div className="provider-select providers-menu">
      <button
        className="ps-trigger"
        onClick={() => setOpen((o) => !o)}
        title={intl.formatMessage(msgs.providers)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="provider-select-label">{intl.formatMessage(msgs.providers)}</span>
        <span className="ps-current">{image?.label}</span>
        <span className="ps-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="ps-scrim" onClick={() => setOpen(false)} />
          <div className="pm-pop" role="dialog" aria-label={intl.formatMessage(msgs.providers)}>
            <div className="pm-row">
              <ProviderPicker
                label={intl.formatMessage(msgs.image)}
                value={imageId}
                groups={imageGroups}
                onPick={pickImage}
              />
              <ApiKeyField settings={settings} setSettings={setSettings} providerId={imageId} />
            </div>

            <div className="pm-row">
              <ProviderPicker
                label={intl.formatMessage(msgs.text)}
                value={textId}
                groups={textGroups}
                onPick={pickText}
                hint={text ? intl.formatMessage(msgs.hintOn) : intl.formatMessage(msgs.hintOff)}
              />
              {/* Same provider for both rows already shares one key — show it once. */}
              {textId !== imageId ? (
                <ApiKeyField settings={settings} setSettings={setSettings} providerId={textId} />
              ) : (
                text?.needsKey && (
                  <span className="pm-shared">{intl.formatMessage(msgs.sharesKey)}</span>
                )
              )}
            </div>

            {/* Upscaler / Enhancer — a local-only feature (the single-image view). Shown online too,
                but LOCKED with a tooltip so visitors can see the feature exists. */}
            <div className="pm-row">
              <ProviderPicker
                label={intl.formatMessage(msgs.upscale)}
                value={upscaleId}
                groups={upscaleGroups}
                onPick={pickUpscale}
                locked={ONLINE}
                lockReason={intl.formatMessage(msgs.upscaleLockedReason)}
                hint={intl.formatMessage(msgs.upscaleHint)}
              />
              {!ONLINE &&
                (upscaleId !== "none" && upscaleId !== imageId && upscaleId !== textId ? (
                  <ApiKeyField settings={settings} setSettings={setSettings} providerId={upscaleId} />
                ) : (
                  upscaleId !== "none" &&
                  getProvider(upscaleId)?.needsKey && (
                    <span className="pm-shared">{intl.formatMessage(msgs.sharesKey)}</span>
                  )
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
