/**
 * A `<table>` of label/value detail rows for the single-image view (empty rows skipped).
 * @module gui/components/single/DetailTable
 */

/** One row in the details table (skipped when empty). */
function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <tr className="g-detail-row">
      <th scope="row" className="g-detail-key">
        {label}
      </th>
      <td className="g-detail-value">{String(value)}</td>
    </tr>
  );
}

/** A `<table>` of label/value detail rows (empty rows skipped). */
export default function DetailTable({ rows }) {
  return (
    <table className="g-detail-table">
      <tbody>
        {rows.map(([k, v]) => (
          <DetailRow key={k} label={k} value={v} />
        ))}
      </tbody>
    </table>
  );
}
