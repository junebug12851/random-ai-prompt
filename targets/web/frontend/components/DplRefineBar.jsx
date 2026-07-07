/**
 * The DPL **refine** toolbar for the Manage-tab block editor — a single tidy row of AI refinements.
 * Each dimension (Detail, Complexity, Focus, Intensity, Variety) is one **stepper combo**: a centered
 * label flanked by `−` (less) and `+` (more) buttons, so a five-way set of one-click tweaks fits on one
 * line without a wall of parallel buttons. A lone **Cleanup** pill rounds it out.
 *
 * The bar is presentational: it renders the {@link module:gui/lib/dpl/dplRefine} catalog and reports the
 * picked action up via `onRefine(action)`. The parent ({@link module:gui/components/ManageBlockEditor})
 * owns the text-provider call, applies the result, validates it, and drives the busy/undo state. The
 * free-text Modify/Draft control lives separately in the editor's corner ({@link DplAskCorner}).
 * @module gui/components/DplRefineBar
 */
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { getDplRefineActions } from "../lib/dpl/dplRefine.js";
import { m } from "../lib/dpl/dplRefineMessages.js";

/** A dimension stepper: `[ − Label + ]`. `−` runs the "less" action, `+` the "more" action. */
function StepperCombo({ label, more, less, busyMode, disabled, onPick }) {
  return (
    <div className="dpl-rf-combo" role="group" aria-label={label}>
      <button
        type="button"
        className={`dpl-rf-step minus${busyMode === less.mode ? " is-busy" : ""}`}
        onClick={() => onPick(less)}
        disabled={disabled}
        aria-busy={busyMode === less.mode || undefined}
        aria-label={less.label}
        title={less.hint}
      >
        −
      </button>
      <span className="dpl-rf-combo-label">{label}</span>
      <button
        type="button"
        className={`dpl-rf-step plus${busyMode === more.mode ? " is-busy" : ""}`}
        onClick={() => onPick(more)}
        disabled={disabled}
        aria-busy={busyMode === more.mode || undefined}
        aria-label={more.label}
        title={more.hint}
      >
        +
      </button>
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} [props.busyMode] The mode string currently running (`""`/undefined when idle).
 * @param {boolean} [props.disabled] Hard-disable every control (e.g. while saving).
 * @param {Function} props.onRefine `(action)` — the picked refine action `{ id, mode, label, … }`.
 * @returns {JSX.Element}
 */
export default function DplRefineBar({ busyMode = "", disabled = false, onRefine }) {
  const intl = useIntl();
  const groups = useMemo(() => getDplRefineActions(intl), [intl]);
  const busy = Boolean(busyMode);
  const anyDisabled = busy || disabled;

  return (
    <div className="dpl-refine-bar" role="toolbar" aria-label={intl.formatMessage(m.toolbar)}>
      <span className="dpl-rf-lead">{intl.formatMessage(busy ? m.working : m.lead)}</span>

      {groups.map((g) => {
        const more = g.actions.find((a) => a.dir === "more");
        const less = g.actions.find((a) => a.dir === "less");
        const solo = g.actions.find((a) => a.dir === "only");
        if (solo) {
          return (
            <button
              key={g.key}
              type="button"
              className={`dpl-rf-solo${busyMode === solo.mode ? " is-busy" : ""}`}
              onClick={() => onRefine(solo)}
              disabled={anyDisabled}
              aria-busy={busyMode === solo.mode || undefined}
              title={solo.hint}
            >
              {solo.label}
            </button>
          );
        }
        return (
          <StepperCombo
            key={g.key}
            label={g.label}
            more={more}
            less={less}
            busyMode={busyMode}
            disabled={anyDisabled}
            onPick={onRefine}
          />
        );
      })}
    </div>
  );
}
