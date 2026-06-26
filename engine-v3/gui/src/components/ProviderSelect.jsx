/**
 * The header provider picker — a custom dropdown grouped into **Local** and **Online**, with a
 * one-line description per provider (and a "key" badge for BYOK ones). Choosing a provider also
 * sets the engine dialect/`mode`.
 * @module gui/components/ProviderSelect
 */
import { useState } from "react";
import { availableProviders } from "../lib/providers/index.js";
import { providerMode } from "../lib/useProvider.js";
import { metaFor } from "../lib/providerMeta.js";

/**
 * @param {object} props `{ settings, setSettings }`.
 * @returns {JSX.Element}
 */
export default function ProviderSelect({ settings, setSettings }) {
  const [open, setOpen] = useState(false);
  const provs = availableProviders();
  const current = provs.find((p) => p.id === settings.provider) || provs[0];
  const local = provs.filter((p) => p.local);
  const online = provs.filter((p) => !p.local);

  const pick = (id) => {
    setSettings((s) => ({ ...s, provider: id, mode: providerMode(id) }));
    setOpen(false);
  };

  const renderGroup = (title, items) =>
    items.length ? (
      <div className="ps-group">
        <div className="ps-group-title">{title}</div>
        {items.map((p) => (
          <button
            key={p.id}
            className={`ps-item${p.id === settings.provider ? " on" : ""}`}
            onClick={() => pick(p.id)}
          >
            <span className="ps-item-head">
              <span className="ps-item-label">{p.label}</span>
              {p.needsKey && <span className="ps-key">key</span>}
            </span>
            <span className="ps-item-desc">{metaFor(p.id).description}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="provider-select">
      <button
        className="ps-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Image provider"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="provider-select-label">Provider</span>
        <span className="ps-current">{current?.label}</span>
        <span className="ps-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="ps-scrim" onClick={() => setOpen(false)} />
          <div className="ps-pop" role="listbox">
            {renderGroup("Local", local)}
            {renderGroup("Online", online)}
          </div>
        </>
      )}
    </div>
  );
}
