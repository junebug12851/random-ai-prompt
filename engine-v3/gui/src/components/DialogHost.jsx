/**
 * Renders the app's in-app dialogs (the Promise-based replacement for native alert/confirm/prompt).
 *
 * Mounted ONCE at the app root, inside the i18n boundary, it subscribes to the `lib/dialog.js`
 * external store and shows the active request (`queue[0]`) as an accessible modal — reusing the
 * existing `.modal` / `.modal-overlay` / `.modal-actions` styling so it looks native to the app.
 * Resolving the pending promise (via `settle`) follows the native contract: confirm → boolean,
 * prompt → string|null, alert → undefined.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, labelled by its title (or the message), Escape and
 * backdrop cancel, Enter accepts, Tab is trapped within the modal, and focus moves to the input
 * (prompt) or the accept button on open and is restored to the previously-focused element on close.
 * @module gui/components/DialogHost
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useIntl, defineMessages } from "react-intl";
import { subscribe, getSnapshot, settle } from "../lib/dialog.js";

const msgs = defineMessages({
  ok: { id: "dialog.ok", defaultMessage: "OK" },
  cancel: { id: "dialog.cancel", defaultMessage: "Cancel" },
});

/** Focusable elements inside `el`, in tab order. */
function focusable(el) {
  if (!el) return [];
  return Array.from(
    el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((n) => !n.disabled && n.tabIndex !== -1);
}

/**
 * The dialog host. Takes no props; reads the active dialog from the `lib/dialog.js` store.
 * @returns {JSX.Element|null} The active modal (via a portal), or null when the queue is empty.
 */
export default function DialogHost() {
  const intl = useIntl();
  const queue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const active = queue[0] || null;

  const [input, setInput] = useState("");
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const acceptRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  // Seed (and reset) the prompt input whenever a new dialog becomes active.
  useEffect(() => {
    if (active) setInput(active.kind === "prompt" ? (active.defaultValue ?? "") : "");
  }, [active]);

  // Move focus into the modal on open; restore it to the prior element on close.
  useLayoutEffect(() => {
    if (!active) return undefined;
    restoreRef.current = document.activeElement;
    const target = active.kind === "prompt" ? inputRef.current : acceptRef.current;
    target?.focus();
    if (active.kind === "prompt") inputRef.current?.select?.();
    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [active]);

  if (!active) return null;

  const isPrompt = active.kind === "prompt";
  const isAlert = active.kind === "alert";

  const accept = () => settle(active.id, isPrompt ? input : isAlert ? undefined : true);
  const cancel = () => settle(active.id, isPrompt ? null : isAlert ? undefined : false);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Enter" && (isAlert || !e.shiftKey)) {
      // In the prompt input, Enter submits; elsewhere Enter accepts (unless focused on Cancel).
      if (document.activeElement?.dataset?.dialogCancel === undefined) {
        e.preventDefault();
        accept();
      }
      return;
    }
    if (e.key === "Tab") {
      const items = focusable(cardRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const acceptLabel = active.confirmLabel || intl.formatMessage(msgs.ok);
  const cancelLabel = active.cancelLabel || intl.formatMessage(msgs.cancel);

  return createPortal(
    <>
      <div className="modal-overlay" onClick={cancel} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={active.title ? titleId : undefined}
        aria-label={active.title ? undefined : active.message}
        aria-describedby={active.message ? descId : undefined}
        ref={cardRef}
        onKeyDown={onKeyDown}
      >
        {active.title && <h2 id={titleId}>{active.title}</h2>}
        {active.message && <p id={descId}>{active.message}</p>}
        {active.note && <p className="modal-note">{active.note}</p>}
        {isPrompt && (
          <input
            ref={inputRef}
            className="modal-input"
            type="text"
            value={input}
            placeholder={active.placeholder || ""}
            onChange={(e) => setInput(e.target.value)}
          />
        )}
        <div className="modal-actions">
          {!isAlert && (
            <button type="button" className="btn-ghost" data-dialog-cancel="" onClick={cancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={active.destructive ? "btn-destructive" : "btn-danger"}
            ref={acceptRef}
            onClick={accept}
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
