/**
 * The DPL insert toolbar that sits above the prompt box: a slim row of category buttons
 * (Chance, Choose, Repeat, Structure, Flow, Emphasis, Code). Each opens a popover listing the
 * non-text DPL constructs in that group — name, one-line description, the literal syntax, and a
 * live re-rolling example where the output is meaningful. Picking an item drops its snippet at
 * the editor's cursor (via the editor's imperative `insertSnippet`).
 *
 * It's a teaching surface as much as an insert tool: the lax line grammar (conditions, choices,
 * calls, …) is hard to discover by typing, so this lays it out, organized and navigable.
 * @module gui/components/DplInsertBar
 */
import { useEffect, useRef, useState } from "react";
import { DPL_INSERTS } from "../lib/dpl/dplInserts.js";
import { expandPrompt } from "../lib/promptEngine.js";

/** Roll one item's `example` DPL into a concrete string (no auto-FX/artist noise). */
const rollExample = (dpl, settings) => {
  try {
    const out = expandPrompt(dpl, { ...settings, autoAddFx: false, autoAddArtists: false });
    return out && out.trim() ? out : "—";
  } catch {
    return "—";
  }
};

/**
 * @param {object} props
 * @param {import("react").RefObject} props.editorRef Ref to the prompt {@link DplEditor} (for insertSnippet).
 * @param {object} props.settings Generation settings (for SFW/NSFW-correct live examples).
 * @returns {JSX.Element}
 */
export default function DplInsertBar({ editorRef, settings }) {
  const [open, setOpen] = useState(null); // open category key, or null
  const [examples, setExamples] = useState({}); // item id -> rolled example (for the open menu)
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const openCat = DPL_INSERTS.find((c) => c.key === open) || null;

  // While a menu is open, re-roll its items' live examples every second.
  useEffect(() => {
    if (!openCat) {
      setExamples({});
      return undefined;
    }
    const withEx = openCat.items.filter((it) => it.example);
    if (!withEx.length) return undefined;
    const roll = () => {
      const next = {};
      for (const it of withEx) next[it.id] = rollExample(it.example, settingsRef.current);
      setExamples(next);
    };
    roll();
    const id = setInterval(roll, 1000);
    return () => clearInterval(id);
  }, [openCat]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (item) => {
    editorRef?.current?.insertSnippet?.(item.template, { line: item.line, wrap: item.wrap });
    setOpen(null);
  };

  return (
    <div className="dpl-insert-bar" role="toolbar" aria-label="Insert DPL syntax">
      <span className="dpl-insert-lead">Insert</span>
      {DPL_INSERTS.map((cat, idx) => (
        <div className="dpl-ins-wrap" key={cat.key}>
          <button
            type="button"
            className={`dpl-ins-btn${open === cat.key ? " on" : ""}`}
            onClick={() => setOpen((o) => (o === cat.key ? null : cat.key))}
            aria-haspopup="menu"
            aria-expanded={open === cat.key}
            title={cat.hint}
          >
            {cat.label}
            <span className="dpl-ins-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {open === cat.key && (
            <div
              className={`dpl-ins-pop${idx >= DPL_INSERTS.length - 2 ? " dpl-ins-pop-right" : ""}`}
              role="menu"
              aria-label={cat.label}
            >
              <div className="dpl-ins-pop-hint">{cat.hint}</div>
              {cat.items.map((it) => (
                <button
                  type="button"
                  className="dpl-ins-item"
                  role="menuitem"
                  key={it.id}
                  onClick={() => pick(it)}
                >
                  <span className="dpl-ins-item-head">
                    <span className="dpl-ins-item-name">{it.label}</span>
                  </span>
                  <span className="dpl-ins-item-desc">{it.desc}</span>
                  <code className="dpl-ins-item-syntax">{it.syntax}</code>
                  {it.example && (
                    <span className="dpl-ins-item-ex">
                      <span className="dpl-ins-item-ex-label">example</span>
                      <span className="dpl-ins-item-ex-text">{examples[it.id] ?? "…"}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {open && (
        <div className="dpl-ins-scrim" onClick={() => setOpen(null)} aria-hidden="true" />
      )}
    </div>
  );
}
