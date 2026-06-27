/**
 * A rich, grouped provider picker — a custom dropdown (not a native combo) with a leading label, a
 * one-line description per option, and a "key" badge for BYOK ones. Reused for both rows of the
 * header Providers menu (the image provider and the text/rewrite provider). The parent owns the
 * selection: pass `value` + grouped `groups` and get `onPick(id)`.
 * @module gui/components/ProviderPicker
 */
import { useState } from "react";

/**
 * @param {object} props
 * @param {string} props.label Leading label shown on the trigger (e.g. "Image" / "Text").
 * @param {string} props.value The selected option id.
 * @param {Array<{title:string, items:Array<{id:string,label:string,needsKey?:boolean,description?:string}>}>} props.groups
 *   Grouped options.
 * @param {Function} props.onPick `(id)` — called when an option is chosen.
 * @returns {JSX.Element}
 */
export default function ProviderPicker({ label, value, groups, onPick }) {
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
        className="ps-trigger"
        onClick={() => setOpen((o) => !o)}
        title={`${label} provider`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="provider-select-label">{label}</span>
        <span className="ps-current">{current?.label}</span>
        <span className="ps-caret">▾</span>
      </button>
      {open && (
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
                      className={`ps-item${it.id === value ? " on" : ""}`}
                      onClick={() => choose(it.id)}
                    >
                      <span className="ps-item-head">
                        <span className="ps-item-label">{it.label}</span>
                        {it.needsKey && <span className="ps-key">key</span>}
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
