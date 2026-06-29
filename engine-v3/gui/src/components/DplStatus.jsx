/**
 * A small live DPL validity indicator: a check when the DPL is clean, an ✕ when it has errors. It
 * reads the same {@link dplStatus} validator that feeds the editor's inline lint underlines, so the
 * icon and the in-editor spots always agree. Hovering lists the specific problems. Warnings (e.g. an
 * unbalanced bracket) don't flip it to ✕ — only real errors do — but they're noted in the tooltip.
 * @module gui/components/DplStatus
 */
import { useMemo } from "react";
import { useIntl, defineMessages } from "react-intl";
import { dplStatus } from "../lib/dpl/validateDpl.js";

const msgs = defineMessages({
  noProblems: { id: "dplStatus.noProblems", defaultMessage: "Valid DPL — no problems." },
  valid: { id: "dplStatus.valid", defaultMessage: "Valid DPL" },
  validWarn: {
    id: "dplStatus.validWarn",
    defaultMessage: "Valid DPL, {count, plural, one {# warning} other {# warnings}}",
  },
  errors: {
    id: "dplStatus.errors",
    defaultMessage: "{count, plural, one {# DPL error} other {# DPL errors}}",
  },
});

/**
 * @param {object} props
 * @param {string} props.value The DPL text to validate.
 * @param {string} [props.className] Extra class for placement.
 * @returns {JSX.Element}
 */
export default function DplStatus({ value, className = "" }) {
  const intl = useIntl();
  const { errors, warnings, diagnostics } = useMemo(
    () => dplStatus(value || "", intl),
    [value, intl],
  );
  const ok = errors === 0;

  const title = diagnostics.length
    ? diagnostics.map((d) => `${d.severity === "error" ? "✕" : "!"} ${d.message}`).join("\n")
    : intl.formatMessage(msgs.noProblems);
  const label = ok
    ? warnings
      ? intl.formatMessage(msgs.validWarn, { count: warnings })
      : intl.formatMessage(msgs.valid)
    : intl.formatMessage(msgs.errors, { count: errors });

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
