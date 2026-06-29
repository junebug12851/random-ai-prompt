/**
 * A small live DPL validity indicator: a check when the DPL is clean, an ✕ when it has errors. It
 * reads the same {@link dplStatus} validator that feeds the editor's inline lint underlines, so the
 * icon and the in-editor spots always agree. Hovering lists the specific problems. Warnings (e.g. an
 * unbalanced bracket) don't flip it to ✕ — only real errors do — but they're noted in the tooltip.
 * @module gui/components/DplStatus
 */
import { useMemo } from "react";
import { dplStatus } from "../lib/dpl/validateDpl.js";

/**
 * @param {object} props
 * @param {string} props.value The DPL text to validate.
 * @param {string} [props.className] Extra class for placement.
 * @returns {JSX.Element}
 */
export default function DplStatus({ value, className = "" }) {
  const { errors, warnings, diagnostics } = useMemo(() => dplStatus(value || ""), [value]);
  const ok = errors === 0;

  const title = diagnostics.length
    ? diagnostics.map((d) => `${d.severity === "error" ? "✕" : "!"} ${d.message}`).join("\n")
    : "Valid DPL — no problems.";
  const label = ok
    ? warnings
      ? `Valid DPL, ${warnings} warning${warnings === 1 ? "" : "s"}`
      : "Valid DPL"
    : `${errors} DPL error${errors === 1 ? "" : "s"}`;

  return (
    <span
      className={`dpl-status ${ok ? (warnings ? "warn" : "ok") : "bad"} ${className}`.trim()}
      title={title}
      role="status"
      aria-label={label}
    >
      {ok ? "✓" : "✕"}
    </span>
  );
}
