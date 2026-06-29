/**
 * The prompt (or negative) card for the single-image view: its layers — sent / AI translation /
 * engine roll / DPL source — most-relevant first, duplicate layers collapsed, each a copyable row
 * with optional inline re-roll / make-variation actions.
 * @module gui/components/single/PromptCard
 */
import { useIntl } from "react-intl";
import { msgs } from "./messages.js";

/**
 * A labeled, copyable block of prompt/negative text (skipped when empty), with optional inline
 * actions (re-roll / make-variation) styled like the copy link.
 */
function TextRow({ label, value, mono, accent, extras }) {
  const intl = useIntl();
  if (!value) return null;
  const copy = () => navigator.clipboard?.writeText(String(value)).catch(() => {});
  return (
    <div className={`g-text-row${accent ? " accent" : ""}`}>
      <div className="g-text-head">
        <span className="g-text-label">{label}</span>
        <span className="g-text-acts">
          {(extras || []).map((a) => (
            <button
              key={a.key}
              className={`g-copy g-act${a.disabled ? " is-locked" : ""}`}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
            >
              {a.label}
              {a.disabled && <span aria-hidden="true"> 🔒</span>}
            </button>
          ))}
          <button className="g-copy" onClick={copy}>
            {intl.formatMessage(msgs.copy)}
          </button>
        </span>
      </div>
      <p className={`g-text-val${mono ? " mono" : ""}`}>{value}</p>
    </div>
  );
}

/** The prompt (or negative) card: its layers, most-relevant first, dupes collapsed. */
export default function PromptCard({ title, layers, extrasFor }) {
  const intl = useIntl();
  if (!layers.final && !layers.ai && !layers.roll && !layers.dpl) return null;
  const showRoll = layers.roll && layers.roll !== layers.final;
  const showAi = layers.ai && layers.ai !== layers.final;
  const ex = (key) => (extrasFor ? extrasFor(key) : []);
  return (
    <section className="g-card">
      <h3 className="g-card-title">{title}</h3>
      <TextRow label={intl.formatMessage(msgs.sentToModel)} value={layers.final} accent extras={ex("final")} />
      {showAi && <TextRow label={intl.formatMessage(msgs.aiTranslation)} value={layers.ai} extras={ex("ai")} />}
      {showRoll && <TextRow label={intl.formatMessage(msgs.engineRoll)} value={layers.roll} extras={ex("roll")} />}
      <TextRow label={intl.formatMessage(msgs.dplSource)} value={layers.dpl} mono extras={ex("dpl")} />
    </section>
  );
}
