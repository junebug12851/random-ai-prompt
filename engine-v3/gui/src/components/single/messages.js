/**
 * @file Shared react-intl messages (and the derive-source layer label map) for the single-image
 * view and its sub-components. One source of truth so the view and the extracted cards stay in sync;
 * ids are explicit, so this is a pure relocation of the strings that lived in SingleView.jsx.
 */
import { defineMessages } from "react-intl";

export const msgs = defineMessages({
  copy: { id: "single.copy", defaultMessage: "copy" },
  reroll: { id: "single.rerollAction", defaultMessage: "re-roll" },
  vary: { id: "single.varyAction", defaultMessage: "vary" },
  sentToModel: { id: "single.sentToModel", defaultMessage: "Sent to model" },
  aiTranslation: { id: "single.aiTranslation", defaultMessage: "AI translation" },
  engineRoll: { id: "single.engineRoll", defaultMessage: "Engine roll" },
  dplSource: { id: "single.dplSource", defaultMessage: "DPL source" },
  noKey: {
    id: "single.noKey",
    defaultMessage: "{provider} has no API key — add one on the Generate screen.",
  },
  providerFallback: { id: "single.providerFallback", defaultMessage: "The rewrite provider" },
  noKeywords: { id: "single.noKeywords", defaultMessage: "The model returned no usable keywords." },
  saveFailed: {
    id: "single.saveFailed",
    defaultMessage: "Couldn't save keywords (no local server?).",
  },
  rebuildFailed: { id: "single.rebuildFailed", defaultMessage: "Keyword rebuild failed: {error}" },
  keywords: { id: "single.keywords", defaultMessage: "Keywords" },
  keywordsEdited: { id: "single.keywordsEdited", defaultMessage: "Keywords · edited" },
  rebuildTitle: {
    id: "single.rebuildTitle",
    defaultMessage:
      "Send the prompt to the AI, break it into a clean alphabetical keyword list, and save it over these",
  },
  rebuilding: { id: "single.rebuilding", defaultMessage: "Rebuilding…" },
  rebuild: { id: "single.rebuild", defaultMessage: "Rebuild with AI" },
  find: { id: "single.find", defaultMessage: "Find “{term}”" },
  noImage: { id: "single.noImage", defaultMessage: "No image loaded." },
  noImageSub: {
    id: "single.noImageSub",
    defaultMessage: "Generate an image or open one from the gallery and it'll show here in full.",
  },
  backTitle: { id: "single.backTitle", defaultMessage: "Back (Esc)" },
  back: { id: "single.back", defaultMessage: "← Back to {target}" },
  galleryFallback: { id: "single.galleryFallback", defaultMessage: "gallery" },
  prevTitle: { id: "single.prevTitle", defaultMessage: "Previous image (←)" },
  prev: { id: "single.prev", defaultMessage: "← Prev" },
  next: { id: "single.next", defaultMessage: "Next →" },
  nextTitle: { id: "single.nextTitle", defaultMessage: "Next image (→)" },
  openFull: { id: "single.openFull", defaultMessage: "Open full image in a new tab" },
  openDefault: { id: "single.openDefault", defaultMessage: "Open in the default app" },
  open: { id: "single.open", defaultMessage: "Open" },
  reveal: { id: "single.reveal", defaultMessage: "Reveal" },
  revealTitle: { id: "single.revealTitle", defaultMessage: "Reveal in file explorer" },
  downloadPng: { id: "single.downloadPng", defaultMessage: "Download PNG" },
  convertTitle: { id: "single.convertTitle", defaultMessage: "Convert & download" },
  convertOption: { id: "single.convertOption", defaultMessage: "Convert & download…" },
  convertLocked: {
    id: "single.convertLocked",
    defaultMessage: "Converting needs ImageMagick installed — it isn't, so this is locked",
  },
  needsMagickOpt: { id: "single.needsMagickOpt", defaultMessage: "Needs ImageMagick" },
  deleteTitle: { id: "single.deleteTitle", defaultMessage: "Delete from disk" },
  delete: { id: "single.delete", defaultMessage: "Delete" },
  details: { id: "single.details", defaultMessage: "Details" },
  viewRaw: { id: "single.viewRaw", defaultMessage: "View Raw" },
  viewTable: { id: "single.viewTable", defaultMessage: "View Table" },
  copyMd: { id: "single.copyMd", defaultMessage: "Copy as Markdown" },
  copyJson: { id: "single.copyJson", defaultMessage: "Copy as JSON" },
  copied: { id: "single.copiedGeneric", defaultMessage: "✓ Copied" },
  copyMdTitle: {
    id: "single.copyMdTitle",
    defaultMessage: "Copy the prompt, negative, and details as a Markdown block",
  },
  copyJsonTitle: {
    id: "single.copyJsonTitle",
    defaultMessage: "Copy the full raw metadata as JSON",
  },
  allSettings: { id: "single.allSettings", defaultMessage: "All settings ({count})" },
  promptTitle: { id: "single.promptTitle", defaultMessage: "Prompt" },
  negativeTitle: { id: "single.negativeTitle", defaultMessage: "Negative prompt" },
  dProvider: { id: "single.detail.provider", defaultMessage: "Provider" },
  dModel: { id: "single.detail.model", defaultMessage: "Model" },
  dSampler: { id: "single.detail.sampler", defaultMessage: "Sampler" },
  dSteps: { id: "single.detail.steps", defaultMessage: "Steps" },
  dCfg: { id: "single.detail.cfg", defaultMessage: "CFG" },
  dSize: { id: "single.detail.size", defaultMessage: "Size" },
  dSeed: { id: "single.detail.seed", defaultMessage: "Seed" },
  dSaved: { id: "single.detail.saved", defaultMessage: "Saved" },
  dFile: { id: "single.detail.file", defaultMessage: "File" },
  // Re-roll / variation
  rerollTitle: {
    id: "single.rerollTitle",
    defaultMessage: "Re-roll the recipe — a fresh random prompt from the DPL, with a new seed",
  },
  varyTitle: { id: "single.varyTitle", defaultMessage: "Make a variation from this layer (new seed)" },
  deriveLocked: {
    id: "single.deriveLocked",
    defaultMessage: "{provider} doesn't support seeds — re-roll & variations need seed control",
  },
  layerMissing: {
    id: "single.layerMissing",
    defaultMessage: "This image has no {layer} layer to vary from",
  },
  confirmReroll: {
    id: "single.confirmReroll",
    defaultMessage: "Re-roll from the DPL recipe? A new image is generated with a new seed.",
  },
  confirmVary: {
    id: "single.confirmVary",
    defaultMessage: "Make a variation from the {layer}? A new image is generated with a new seed.",
  },
  deriveError: { id: "single.deriveError", defaultMessage: "Couldn't make another: {error}" },
  // Strips + ancestry
  stripRerolls: { id: "single.stripRerolls", defaultMessage: "Re-Rolls" },
  stripVariations: { id: "single.stripVariations", defaultMessage: "Variations" },
  stripResizes: { id: "single.stripResizes", defaultMessage: "Resizes" },
  lineage: { id: "single.lineage", defaultMessage: "Lineage" },
  typeBase: { id: "single.typeBase", defaultMessage: "Base image" },
  typeReroll: { id: "single.typeReroll", defaultMessage: "Re-roll" },
  typeVariation: { id: "single.typeVariation", defaultMessage: "Variation" },
  typeResize: { id: "single.typeResize", defaultMessage: "Resize" },
  fromLayer: { id: "single.fromLayer", defaultMessage: "from {layer}" },
  parentLink: { id: "single.parentLink", defaultMessage: "↑ Parent" },
  parentTitle: { id: "single.parentTitle", defaultMessage: "Open the image this was made from" },
  layerDpl: { id: "single.layerDpl", defaultMessage: "DPL" },
  layerFinal: { id: "single.layerFinal", defaultMessage: "sent prompt" },
  layerAi: { id: "single.layerAi", defaultMessage: "translation" },
  layerRoll: { id: "single.layerRoll", defaultMessage: "original roll" },
  // Resize
  resizeOption: { id: "single.resizeOption", defaultMessage: "Resize…" },
  resizeTitle: { id: "single.resizeTitle", defaultMessage: "Resize into a new image" },
  resizeGroupMagick: { id: "single.resizeGroupMagick", defaultMessage: "ImageMagick" },
  resizeGroupAi: { id: "single.resizeGroupAi", defaultMessage: "AI" },
  resizeDown: { id: "single.resizeDown", defaultMessage: "{label} (downscale)" },
  resizeUp: { id: "single.resizeUp", defaultMessage: "{label} (upscale)" },
  resizeNeedsMagick: { id: "single.resizeNeedsMagick", defaultMessage: "{label} — needs ImageMagick" },
  resizeLocked: {
    id: "single.resizeLocked",
    defaultMessage: "Resizing needs ImageMagick installed — it isn't, so this is locked",
  },
  aiUpscale: { id: "single.aiUpscale", defaultMessage: "AI Upscale · {provider}" },
  aiNeedsKey: { id: "single.aiNeedsKey", defaultMessage: "{provider} — add a key to use" },
  aiUpscaleNone: {
    id: "single.aiUpscaleNone",
    defaultMessage: "AI Upscale — no provider added yet",
  },
});

// Human label (a `msgs` entry) for a derive source layer.
export const layerMsg = {
  dpl: msgs.layerDpl,
  final: msgs.layerFinal,
  ai: msgs.layerAi,
  roll: msgs.layerRoll,
};
