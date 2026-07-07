/**
 * The free-text AI control pinned to the top-right **corner** of the Manage block editor's DPL box: a
 * joined **Modify / Draft** combo that opens a small popover with one input. **Modify** re-processes the
 * current template with a typed instruction; **Draft** builds a fresh template from a description. It's
 * a compact corner affordance (like the composer's eye/gear) rather than a slab under the toolbar.
 *
 * Presentational: it reports the typed text up via `onCustom(instruction)` / `onCreate(description)`;
 * the parent ({@link module:gui/components/ManageBlockEditor}) owns the provider call + apply + busy.
 * @module gui/components/DplAskCorner
 */
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { m } from "../lib/dpl/dplRefineMessages.js";

/**
 * @param {object} props
 * @param {string} [props.busyMode] The mode string currently running (`""`/undefined when idle).
 * @param {boolean} [props.disabled] Hard-disable the control (e.g. while saving).
 * @param {Function} props.onCreate `(description)` — draft a new template.
 * @param {Function} props.onCustom `(instruction)` — apply a change to the current template.
 * @returns {JSX.Element}
 */
export default function DplAskCorner({ busyMode = "", disabled = false, onCreate, onCustom }) {
  const intl = useIntl();
  const busy = Boolean(busyMode);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("modify");
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  const running = busyMode === "dpl-custom" || busyMode === "dpl-create";
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, intent]);
  // Keep the popover open while a request runs; close it once it settles.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) setOpen(false);
    wasBusy.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const pick = (next) => {
    if (open && intent === next) {
      setOpen(false);
      return;
    }
    setIntent(next);
    setOpen(true);
  };

  const submit = () => {
    const t = text.trim();
    if (!t) {
      inputRef.current?.focus();
      return;
    }
    if (intent === "create") onCreate?.(t);
    else onCustom?.(t);
    // Text is kept: modify is iterative, and a validation bounce shouldn't wipe it.
  };

  const isCreate = intent === "create";
  const sendLabel = running ? (isCreate ? m.drafting : m.modifying) : isCreate ? m.createSubmit : m.send;

  return (
    <div className="dpl-ask-corner">
      <div className="dpl-ask-combo" role="group" aria-label={intl.formatMessage(m.toolbarAsk)}>
        <button
          type="button"
          className={`dpl-ask-seg${open && intent === "modify" ? " on" : ""}`}
          onClick={() => pick("modify")}
          disabled={disabled || busy}
          aria-haspopup="dialog"
          aria-expanded={open && intent === "modify"}
          title={intl.formatMessage(m.askModifyHint)}
        >
          {intl.formatMessage(m.askModify)}
        </button>
        <button
          type="button"
          className={`dpl-ask-seg${open && intent === "create" ? " on" : ""}`}
          onClick={() => pick("create")}
          disabled={disabled || busy}
          aria-haspopup="dialog"
          aria-expanded={open && intent === "create"}
          title={intl.formatMessage(m.askCreateHint)}
        >
          {intl.formatMessage(m.askCreate)}
        </button>
      </div>

      {open && (
        <>
          <div className="dpl-ask-scrim" onClick={() => !busy && setOpen(false)} aria-hidden="true" />
          <div className="dpl-ask-pop" role="dialog" aria-label={intl.formatMessage(isCreate ? m.askCreateTitle : m.askModifyTitle)}>
            <div className="dpl-ask-pop-title">{intl.formatMessage(isCreate ? m.askCreateTitle : m.askModifyTitle)}</div>
            <textarea
              ref={inputRef}
              className="dpl-ask-input"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={intl.formatMessage(isCreate ? m.createPlaceholder : m.modifyPlaceholder)}
              aria-label={intl.formatMessage(isCreate ? m.createAria : m.modifyAria)}
              disabled={busy}
            />
            <div className="dpl-ask-pop-foot">
              <span className="dpl-ask-hint">{intl.formatMessage(m.askEnterHint)}</span>
              <button type="button" className="primary dpl-ask-send" onClick={submit} disabled={busy || !text.trim()}>
                {intl.formatMessage(sendLabel)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
