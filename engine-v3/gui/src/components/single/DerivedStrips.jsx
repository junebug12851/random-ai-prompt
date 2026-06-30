/**
 * The derived children shown beneath the main image on the single view. Instead of three separate
 * strips (Re-Rolls / Variations / Resizes), every child sits in ONE grid directly below the main
 * image, colour-coded by kind (re-roll / variation / resize) with a per-thumb tooltip and a small
 * legend. Each kind's in-flight derivations show as a live spinner placeholder. The whole block is
 * omitted when there are no children and nothing pending.
 * @module gui/components/single/DerivedStrips
 */
import { useIntl } from "react-intl";
import { msgs } from "./messages.js";

// Render order + the colour-coded kind metadata (label message + CSS modifier).
const KINDS = [
  { kind: "reroll", label: msgs.typeReroll, legend: msgs.stripRerolls },
  { kind: "variation", label: msgs.typeVariation, legend: msgs.stripVariations },
  { kind: "resize", label: msgs.typeResize, legend: msgs.stripResizes },
];

/**
 * The derived-children grid.
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

  const total =
    KINDS.reduce((n, k) => n + groups[k.kind].length + pendingOf(k.kind), 0);
  if (!total) return null;

  // Flatten every kind's pending placeholders + children into one colour-coded grid, kept in a
  // stable kind order (re-rolls, then variations, then resizes) so the colours read as bands.
  const cells = [];
  for (const { kind, label } of KINDS) {
    const kindLabel = intl.formatMessage(label);
    const pending = pendingOf(kind);
    for (let i = 0; i < pending; i++) {
      cells.push(
        <div
          className={`dv-cell kind-${kind} is-pending`}
          key={`p-${kind}-${i}`}
          aria-busy="true"
          title={kindLabel}
        >
          <div className="g-pending-spinner small" aria-hidden="true" />
        </div>,
      );
    }
    for (const c of groups[kind]) {
      const ci = items.find((it) => it.path === c.path);
      cells.push(
        <button
          key={c.path}
          className={`dv-cell kind-${kind}`}
          onClick={() => ci && onNavigate(ci)}
          title={kindLabel}
          aria-label={kindLabel}
        >
          <img src={c.path} alt="" loading="lazy" />
          <span className="dv-tag" aria-hidden="true">
            {kindLabel}
          </span>
        </button>,
      );
    }
  }

  return (
    <div className="derived-grid">
      <div className="derived-legend">
        {KINDS.map(({ kind, legend }) => {
          const count = groups[kind].length + pendingOf(kind);
          if (!count) return null;
          return (
            <span className={`dv-legend-item kind-${kind}`} key={kind}>
              <span className="dv-swatch" aria-hidden="true" />
              {intl.formatMessage(legend)} <span className="dv-legend-count">{count}</span>
            </span>
          );
        })}
      </div>
      <div className="derived-grid-row">{cells}</div>
    </div>
  );
}
