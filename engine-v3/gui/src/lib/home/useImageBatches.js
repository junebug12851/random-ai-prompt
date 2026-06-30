/**
 * @file Home image-generation state + lifecycle, as a hook. Owns the generated-prompt list
 * (each with its image batches), the in-flight image error, and the running id counter, and
 * exposes the operations the composer drives: run a batch (with the prose/keyword rewrite passes
 * and the per-image sidecar), and remove/clear images, batches, or the whole list (optionally
 * deleting the files from disk). Lifting this out of Home.jsx keeps the component a thin
 * coordinator over the palette, the composer, and this hook.
 */
import { useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { rewritePrompt } from "../rewrite.js";
import { expandPrompt } from "../promptEngine.js";
import { ingestImage, isOutputFile, deleteImageFile } from "../output.js";
import { effectiveKey } from "../sessionKeys.js";
import { cleanSnapshot } from "./snapshot.js";

const msgs = defineMessages({
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
});

/**
 * Generated-prompt list + image-batch lifecycle for the Home composer.
 * @param {object} args
 * @param {object} args.settings The current app settings.
 * @param {object|null} args.provider The active image provider (or null).
 * @param {object} args.flat The flattened provider settings (app + namespaced params + dialect).
 * @returns {object} `{ prompts, setPrompts, nextId, imgError, makeBatch, removeImage,
 *   removeBatch, clearImages, clearAll }`.
 */
export function useImageBatches({ settings, provider, flat }) {
  const intl = useIntl();
  const [prompts, setPrompts] = useState([]);
  const [imgError, setImgError] = useState("");
  const idCounter = useRef(0);
  const nextId = () => ++idCounter.current;

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
      setPrompts((ps) => ps.map((x) => (x.id === promptId ? { ...x, negRoll, negAi } : x)));

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
    if (isOutputFile(img) && confirm(intl.formatMessage(msgs.confirmDeleteImage))) {
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
    if (imgs.some(isOutputFile) && confirm(intl.formatMessage(msgs.confirmDeletePromptImgs))) {
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
    if (imgs.length && confirm(intl.formatMessage(msgs.confirmClearAll, { count: imgs.length }))) {
      imgs.forEach(deleteImageFile);
    }
    setPrompts([]);
  }

  return {
    prompts,
    setPrompts,
    nextId,
    imgError,
    makeBatch,
    removeImage,
    removeBatch,
    clearImages,
    clearAll,
  };
}
