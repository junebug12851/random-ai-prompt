/**
 * The DPL **refine** toolbar for the Manage-tab block editor. It sits under the insert toolbar and
 * offers one-click AI refinements of the current template, grouped by dimension (Detail, Complexity,
 * Focus, Intensity, Variety) as more/less pill pairs, plus a Tighten polish action and a
 * "Draft from description" control that builds a whole template from a plain-English prompt.
 *
 * The bar is presentational: it renders the {@link module:gui/lib/dpl/dplRefine} catalog and reports
 * the picked action up via `onRefine(action)` / the typed description via `onCreate(text)`. The parent
 * ({@link module:gui/components/ManageBlockEditor}) owns the text-provider call, applies the result to
 * the editor, validates it, and drives the busy/undo state — so refine reuses the same BYOK provider
 * path as the list editor's "AI Expand".
 * @module gui/components/DplRefineBar
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { getDplRefineActions } from "../lib/dpl/dplRefine.js";
import { m } from "../lib/dpl/dplRefineMessages.js";

/** One refine pill. Shows its label, a tooltip hint, a +/− direction glyph, and a busy state. */
function RefinePill({ action, busy, running, disabled, onPick }) {
  const glyph = action.dir === "more" ? "+" : action.dir === "less" ? "−" : "";
  return (
    <button
      type="button"
      className={`dpl-rf-pill dir-${action.dir}${running ? " is-busy" : ""}`}
      onClick={() => onPick(action)}
      disabled={disabled}
      aria-busy={running || undefined}
      title={action.hint}
    >
      {glyph && (
        <span className="dpl-rf-glyph" aria-hidden="true">
          {glyph}
        </span>
      )}
      {action.label}
    </button>
  );
}

/**
 * @param {object} props
 * @param {string} [props.busyMode] The mode string currently running (`""`/undefined when idle).
 * @param {boolean} [props.disabled] Hard-disable every control (e.g. while saving).
 * @param {Function} props.onRefine `(action)` — the picked refine action `{ id, mode, label, … }`.
 * @param {Function} props.onCreate `(description)` — the typed description for a fresh draft.
 * @returns {JSX.Element}
 */
export default function DplRefineBar({ busyMode = "", disabled = false, onRefine, onCreate }) {
  const intl = useIntl();
  const groups = useMemo(() => getDplRefineActions(intl), [intl]);
  const busy = Boolean(busyMode);
  const anyDisabled = busy || disabled;

  const [creating, setCreating] = useState(false);
  const [desc, setDesc] = useState("");
  const inputRef = useRef(null);

  const createRunning = busyMode === "dpl-create";
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const submitCreate = () => {
    const text = desc.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    onCreate?.(text);
    setCreating(false);
    setDesc("");
  };

  return (
    <div className="dpl-refine-bar" role="toolbar" aria-label={intl.formatMessage(m.toolbar)}>
      <span className="dpl-rf-lead">
        {intl.formatMessage(busy ? (createRunning ? m.drafting : m.working) : m.lead)}
      </span>

      {groups.map((g) => (
        <div className="dpl-rf-group" key={g.key}>
          <span className="dpl-rf-group-label">{g.label}</span>
          <div className="dpl-rf-group-pills">
            {g.actions.map((a) => (
              <RefinePill
                key={a.id}
                action={a}
                busy={busy}
                running={busyMode === a.mode}
                disabled={anyDisabled}
                onPick={onRefine}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="dpl-rf-sep" aria-hidden="true" />

      <div className="dpl-rf-create">
        {!creating ? (
          <button
            type="button"
            className="dpl-rf-create-open"
            onClick={() => setCreating(true)}
            disabled={anyDisabled}
            title={intl.formatMessage(m.createOpenHint)}
          >
            {intl.formatMessage(m.createOpen)}
          </button>
        ) : (
          <div className="dpl-rf-create-row">
            <textarea
              ref={inputRef}
              className="dpl-rf-create-input"
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitCreate();
                if (e.key === "Escape") {
                  setCreating(false);
                  setDesc("");
                }
              }}
              placeholder={intl.formatMessage(m.createPlaceholder)}
              aria-label={intl.formatMessage(m.createAria)}
              disabled={anyDisabled}
            />
            <div className="dpl-rf-create-actions">
              <button type="button" className="primary" onClick={submitCreate} disabled={anyDisabled || !desc.trim()}>
                {intl.formatMessage(createRunning ? m.drafting : m.createSubmit)}
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setCreating(false);
                  setDesc("");
                }}
                disabled={busy}
              >
                {intl.formatMessage(m.createCancel)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
