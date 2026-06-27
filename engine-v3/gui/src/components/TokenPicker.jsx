/**
 * A searchable grid of insertable token chips (capped at 400 rendered so big lists
 * like danbooru stay snappy).
 * @module gui/components/TokenPicker
 */
import { useState } from "react";

// A searchable grid of tokens. Click one to insert it into the prompt. Capped at
// a few hundred rendered chips so the big lists (danbooru, etc.) stay snappy.
/**
 * @param {object} props
 * @param {string[]} props.tokens The tokens to show.
 * @param {Function} props.onInsert Called with the clicked token.
 * @returns {JSX.Element}
 */
export default function TokenPicker({ tokens, onInsert }) {
  const [q, setQ] = useState("");
  const filtered = q ? tokens.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : tokens;
  const shown = filtered.slice(0, 400);

  return (
    <div className="picker">
      <input
        className="picker-filter"
        placeholder={`Filter ${tokens.length}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="picker-list">
        {shown.map((t) => (
          <button key={t} className="chip" title="Insert" onClick={() => onInsert(t)}>
            {t}
          </button>
        ))}
        {filtered.length > shown.length && (
          <span className="picker-more">+{filtered.length - shown.length} more — keep typing</span>
        )}
      </div>
    </div>
  );
}
