/**
 * The lineage header line for the single-image view: a type label (Base / Re-roll / Variation /
 * Resize) and a link up to the parent image. The derived-child strips live below the image, not here.
 * @module gui/components/single/LineageHead
 */
import { useIntl } from "react-intl";
import { msgs, layerMsg } from "./messages.js";

/**
 * The lineage header line.
 * @param {object} props
 * @param {object} props.item The current gallery item.
 * @param {object[]} props.items The feed (to resolve the parent).
 * @param {Function} props.onNavigate `(item)` — open another image.
 * @returns {JSX.Element|null}
 */
export default function LineageHead({ item, items, onNavigate }) {
  const intl = useIntl();
  const m = item.meta || {};
  const parentItem = m.parent ? items.find((it) => it.name === m.parent) : null;
  if (!m.parent && !(item.children && item.children.length)) return null;

  const typeMsg =
    m.derivedKind === "reroll"
      ? msgs.typeReroll
      : m.derivedKind === "resize"
        ? msgs.typeResize
        : m.derivedKind === "variation"
          ? msgs.typeVariation
          : msgs.typeBase;
  const srcMsg = layerMsg[m.derivedSource];

  return (
    <div className="g-lineage-head">
      <span className="g-lineage-type">
        {intl.formatMessage(typeMsg)}
        {m.parent && srcMsg && m.derivedKind !== "resize" && (
          <span className="g-lineage-from">
            {" "}
            {intl.formatMessage(msgs.fromLayer, { layer: intl.formatMessage(srcMsg) })}
          </span>
        )}
        {m.derivedKind === "resize" && m.resizeScale && (
          <span className="g-lineage-from"> ({m.resizeScale}×)</span>
        )}
      </span>
      {parentItem && (
        <button
          className="g-lineage-parent"
          onClick={() => onNavigate(parentItem)}
          title={intl.formatMessage(msgs.parentTitle)}
        >
          {intl.formatMessage(msgs.parentLink)}
        </button>
      )}
    </div>
  );
}
