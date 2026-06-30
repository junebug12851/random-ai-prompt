/**
 * The derived-child strips shown beneath the main image on the single view: Re-Rolls, Variations,
 * Resizes. Each strip lists that kind's children (clickable thumbnails) plus a live spinner
 * placeholder per in-flight derivation of that kind. A strip is omitted when it has neither.
 * @module gui/components/single/DerivedStrips
 */
import { useIntl } from "react-intl";
import { msgs } from "./messages.js";

/**
 * The derived-child strips.
 * @param {object} props
 * @param {object} props.item The current gallery item (its `children`).
 * @param {object[]} props.items The feed (to resolve child items).
 * @param {object[]} props.derivations In-flight derivations `{ parentPath, kind }`.
 * @param {Function} props.onNavigate `(item)` — open a child image.
 * @returns {JSX.Element|null}
 */
export default function DerivedStrips({ item, items, derivations, onNavigate }) {
  const intl = useIntl();
  const groups = { reroll: [], variation: [], resize: [] };
  for (const c of item.children || []) if (groups[c.kind]) groups[c.kind].push(c);
  const pendingOf = (kind) =>
    derivations.filter((d) => d.parentPath === item.path && d.kind === kind).length;

  const strips = [
    ["reroll", msgs.stripRerolls],
    ["variation", msgs.stripVariations],
    ["resize", msgs.stripResizes],
  ];

  const rendered = strips
    .map(([kind, label]) => {
      const kids = groups[kind] || [];
      const pending = pendingOf(kind);
      if (!kids.length && !pending) return null;
      return (
        <div className="g-strip" key={kind}>
          <div className="g-strip-label">
            {intl.formatMessage(label)} <span className="g-strip-count">{kids.length}</span>
          </div>
          <div className="g-strip-row">
            {Array.from({ length: pending }).map((_, i) => (
              <div className="g-strip-thumb is-pending" key={`p-${i}`} aria-busy="true">
                <div className="g-pending-spinner small" aria-hidden="true" />
              </div>
            ))}
            {kids.map((c) => {
              const ci = items.find((it) => it.path === c.path);
              return (
                <button
                  key={c.path}
                  className="g-strip-thumb"
                  onClick={() => ci && onNavigate(ci)}
                >
                  <img src={c.path} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        </div>
      );
    })
    .filter(Boolean);

  if (!rendered.length) return null;
  return <div className="g-strips">{rendered}</div>;
}
