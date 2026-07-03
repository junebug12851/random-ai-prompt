/**
 * The clickable keyword cloud for the single-image view. Prefers a saved keyword list on the
 * sidecar (`meta.keywords`); otherwise it parses clean tags from the sent prompt. "Rebuild with AI"
 * asks the rewrite provider for a tidy tag list and saves it over the sidecar's set.
 * @module gui/components/single/KeywordsCard
 */
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isOutputFile, updateImageMeta } from "../../lib/output.js";
import { parseKeywords, normalizeKeywordList } from "../../lib/keywords.js";
import { rewritePrompt } from "../../lib/rewrite.js";
import { effectiveKey } from "../../lib/sessionKeys.js";
import { getProvider } from "../../lib/providers/index.js";
import { msgs } from "./messages.js";

/**
 * The clickable keyword cloud.
 * @param {object} props
 * @param {string} props.text The sent-to-model prompt text.
 * @param {string[]|null} props.saved A saved keyword list from the sidecar, or null.
 * @param {object} props.item The gallery item (for its served path / on-disk check).
 * @param {object} props.settings App settings (rewrite provider + key).
 * @param {Function} props.onSearch `(term)` — search the gallery for a keyword.
 * @param {Function} props.onSaved `(meta)` — a fresh sidecar after a save.
 * @returns {JSX.Element|null}
 */
export default function KeywordsCard({ text, saved, item, settings, onSearch, onSaved }) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tags = useMemo(() => {
    if (Array.isArray(saved) && saved.length) return saved.slice(0, 80);
    return parseKeywords(text).map((k) => k.display);
  }, [saved, text]);

  const rewriteId = settings?.rewriteProvider;
  const hasRewrite = rewriteId && rewriteId !== "none";
  // The image supports an AI keyword rebuild (it's a saved local file with prompt text). Whether a
  // Text provider is actually chosen is a *separate* gate — so the button can stay visible but locked.
  const rebuildable = isOutputFile(item?.path) && Boolean(text && text.trim());

  async function rebuild() {
    setError("");
    const key = effectiveKey(rewriteId, settings);
    if (!key) {
      setError(
        intl.formatMessage(msgs.noKey, {
          provider: getProvider(rewriteId)?.label || intl.formatMessage(msgs.providerFallback),
        }),
      );
      return;
    }
    setBusy(true);
    try {
      const reply = await rewritePrompt({ providerId: rewriteId, prompt: text, key, mode: "keyword" });
      const keywords = normalizeKeywordList((reply || "").split(/[,\n]+/), { sort: true });
      if (!keywords.length) {
        setError(intl.formatMessage(msgs.noKeywords));
        return;
      }
      const meta = await updateImageMeta(item.path, { keywords });
      if (meta) onSaved?.(meta);
      else setError(intl.formatMessage(msgs.saveFailed));
    } catch (e) {
      setError(intl.formatMessage(msgs.rebuildFailed, { error: e.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }

  if (tags.length < 2 && !rebuildable) return null;

  return (
    <section className="g-card">
      <div className="g-card-head">
        <h3 className="g-card-title">
          {intl.formatMessage(
            Array.isArray(saved) && saved.length ? msgs.keywordsEdited : msgs.keywords,
          )}
        </h3>
        {rebuildable && (
          <button
            className="g-card-action"
            onClick={rebuild}
            disabled={busy || !hasRewrite}
            title={intl.formatMessage(hasRewrite ? msgs.rebuildTitle : msgs.rebuildLocked)}
          >
            {intl.formatMessage(busy ? msgs.rebuilding : msgs.rebuild)}
          </button>
        )}
      </div>
      {error && <p className="g-card-err">{error}</p>}
      {tags.length > 0 && (
        <div className="g-cloud">
          {tags.map((t, i) => (
            <button
              key={`${t}-${i}`}
              className="g-cloud-chip"
              onClick={() => onSearch(t)}
              title={intl.formatMessage(msgs.find, { term: t })}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
