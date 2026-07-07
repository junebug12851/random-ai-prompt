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
import { useMemo, useRef, useState } from "react";
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
 * @param {Function} props.onCustom `(instruction)` — a free-text change to apply to the current template.
 * @returns {JSX.Element}
 */
export default function DplRefineBar({ busyMode = "", disabled = false, onRefine, onCreate, onCustom }) {
  const intl = useIntl();
  const groups = useMemo(() => getDplRefineActions(intl), [intl]);
  const busy = Boolean(busyMode);
  const anyDisabled = busy || disabled;

  // The free-text box: "modify" re-processes the current template; "create" drafts a new one.
  const [intent, setIntent] = useState("modify");
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  const createRunning = busyMode === "dpl-create";
  const customRunning = busyMode === "dpl-custom";
  const leadMsg = customRunning ? m.modifying : createRunning ? m.drafting : busy ? m.working : m.lead;

  const submitAsk = () => {
    const t = text.trim();
    if (!t) {
      inputRef.current?.focus();
      return;
    }
    if (intent === "create") onCreate?.(t);
    else onCustom?.(t);
    // Keep the text: modify is often iterative, and a validation bounce (no provider) shouldn't wipe it.
  };

  const setMode = (next) => {
    setIntent(next);
    inputRef.current?.focus();
  };

  return (
    <div className="dpl-refine-bar" role="toolbar" aria-label={intl.formatMessage(m.toolbar)}>
      <span className="dpl-rf-lead">{intl.formatMessage(leadMsg)}</span>

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

      <div className="dpl-rf-ask">
        <div className="dpl-rf-ask-seg" role="tablist" aria-label={intl.formatMessage(m.toolbar)}>
          <button
            type="button"
            role="tab"
            aria-selected={intent === "modify"}
            className={`dpl-rf-seg-btn${intent === "modify" ? " on" : ""}`}
            onClick={() => setMode("modify")}
            disabled={anyDisabled}
            title={intl.formatMessage(m.askModifyHint)}
          >
            {intl.formatMessage(m.askModify)}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={intent === "create"}
            className={`dpl-rf-seg-btn${intent === "create" ? " on" : ""}`}
            onClick={() => setMode("create")}
            disabled={anyDisabled}
            title={intl.formatMessage(m.askCreateHint)}
          >
            {intl.formatMessage(m.askCreate)}
          </button>
        </div>
        <div className="dpl-rf-ask-row">
          <textarea
            ref={inputRef}
            className="dpl-rf-ask-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitAsk();
              }
            }}
            placeholder={intl.formatMessage(intent === "create" ? m.createPlaceholder : m.modifyPlaceholder)}
            aria-label={intl.formatMessage(intent === "create" ? m.createAria : m.modifyAria)}
            disabled={anyDisabled}
          />
          <button type="button" className="primary dpl-rf-ask-send" onClick={submitAsk} disabled={anyDisabled || !text.trim()}>
            {intl.formatMessage(intent === "create" ? m.createSubmit : m.send)}
          </button>
        </div>
      </div>
    </div>
  );
}
