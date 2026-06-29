/**
 * A rich, grouped provider picker — a custom dropdown (not a native combo) with a leading label, a
 * one-line description per option, and a "key" badge for BYOK ones. Reused for both rows of the
 * header Providers menu (the image provider and the text/rewrite provider). The parent owns the
 * selection: pass `value` + grouped `groups` and get `onPick(id)`.
 * @module gui/components/ProviderPicker
 */
import { useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { lockedHint, openFullVersion } from "../lib/online.js";

const msgs = defineMessages({
  providerTitle: {
    id: "providerPicker.title",
    defaultMessage: "{label} provider",
    description: "Tooltip on the provider dropdown trigger (label = Image/Text)",
  },
  lockBadge: {
    id: "providerPicker.lockBadge",
    defaultMessage: "🔒 full version",
    description: "Badge on a provider only available in the full desktop version",
  },
  keyBadge: {
    id: "providerPicker.keyBadge",
    defaultMessage: "key",
    description: "Badge marking a provider that needs a bring-your-own API key",
  },
  softLock: {
    id: "providerPicker.softLock",
    defaultMessage: "NSFW mode is on — {label} is a safe-for-work service",
    description: "Neutral soft-lock tooltip (never says the user can't use it)",
  },
});

/**
 * @param {object} props
 * @param {string} props.label Leading label shown on the trigger (e.g. "Image" / "Text").
 * @param {string} props.value The selected option id.
 * @param {Array<{title:string, items:Array<{id:string,label:string,needsKey?:boolean,description?:string,locked?:boolean}>}>} props.groups
 *   Grouped options. A `locked` option is shown greyed and, when clicked, opens the full version
 *   instead of being selected.
 * @param {Function} props.onPick `(id)` — called when an option is chosen.
 * @returns {JSX.Element}
 */
export default function ProviderPicker({ label, value, groups, onPick, locked, lockReason }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const current = all.find((it) => it.id === value) || all[0];

  const choose = (id) => {
    onPick(id);
    setOpen(false);
  };

  return (
    <div className="provider-select provider-picker">
      <button
        className={`ps-trigger${locked ? " is-locked" : ""}`}
        onClick={() => (locked ? openFullVersion() : setOpen((o) => !o))}
        title={locked ? lockedHint(intl, label, lockReason) : intl.formatMessage(msgs.providerTitle, { label })}
        aria-haspopup="listbox"
        aria-expanded={locked ? false : open}
        aria-disabled={locked || undefined}
      >
        <span className="provider-select-label">{label}</span>
        <span className="ps-current">{current?.label}</span>
        {locked ? (
          <span className="ps-lock" aria-hidden="true">
            🔒
          </span>
        ) : (
          <span className="ps-caret">▾</span>
        )}
      </button>
      {!locked && open && (
        <>
          <div className="ps-scrim" onClick={() => setOpen(false)} />
          <div className="ps-pop" role="listbox">
            {groups
              .filter((g) => g.items.length)
              .map((g) => (
                <div className="ps-group" key={g.title}>
                  <div className="ps-group-title">{g.title}</div>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      className={`ps-item${it.id === value ? " on" : ""}${it.locked ? " is-locked" : ""}${it.softLock ? " is-soft" : ""}`}
                      aria-disabled={it.locked || undefined}
                      title={
                        it.locked
                          ? lockedHint(intl, it.label, it.lockReason)
                          : it.softLock
                            ? intl.formatMessage(msgs.softLock, { label: it.label })
                            : undefined
                      }
                      onClick={() => (it.locked ? openFullVersion() : choose(it.id))}
                    >
                      <span className="ps-item-head">
                        <span className="ps-item-label">
                          {/* Soft-lock (SFW-only provider while NSFW mode is on): a neutral icon,
                              still selectable — the confirm happens at use, never here. */}
                          {it.softLock && (
                            <span className="ps-soft" aria-hidden="true" title={intl.formatMessage(msgs.softLock, { label: it.label })}>
                              🔒
                            </span>
                          )}
                          {it.label}
                        </span>
                        {it.locked ? (
                          <span className="ps-lock">{intl.formatMessage(msgs.lockBadge)}</span>
                        ) : (
                          it.needsKey && <span className="ps-key">{intl.formatMessage(msgs.keyBadge)}</span>
                        )}
                      </span>
                      {it.description && <span className="ps-item-desc">{it.description}</span>}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
