/**
 * A searchable grid of insertable token chips (capped at 400 rendered so big lists
 * like danbooru stay snappy).
 * @module gui/components/TokenPicker
 */
import { useState } from "react";
import { useIntl, defineMessages } from "react-intl";

const msgs = defineMessages({
  filter: {
    id: "tokenPicker.filter",
    defaultMessage: "Filter {count}…",
    description: "Placeholder for the token search box (count = number of tokens)",
  },
  insert: { id: "tokenPicker.insert", defaultMessage: "Insert" },
  more: {
    id: "tokenPicker.more",
    defaultMessage: "+{count} more — keep typing",
    description: "Hint shown when results are truncated",
  },
});

// A searchable grid of tokens. Click one to insert it into the prompt. Capped at
// a few hundred rendered chips so the big lists (danbooru, etc.) stay snappy.
/**
 * @param {object} props
 * @param {string[]} props.tokens The tokens to show.
 * @param {Function} props.onInsert Called with the clicked token.
 * @returns {JSX.Element}
 */
export default function TokenPicker({ tokens, onInsert }) {
  const intl = useIntl();
  const [q, setQ] = useState("");
  const filtered = q ? tokens.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : tokens;
  const shown = filtered.slice(0, 400);

  return (
    <div className="picker">
      <input
        className="picker-filter"
        placeholder={intl.formatMessage(msgs.filter, { count: tokens.length })}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="picker-list">
        {shown.map((t) => (
          <button
            key={t}
            className="chip"
            title={intl.formatMessage(msgs.insert)}
            onClick={() => onInsert(t)}
          >
            {t}
          </button>
        ))}
        {filtered.length > shown.length && (
          <span className="picker-more">
            {intl.formatMessage(msgs.more, { count: filtered.length - shown.length })}
          </span>
        )}
      </div>
    </div>
  );
}
