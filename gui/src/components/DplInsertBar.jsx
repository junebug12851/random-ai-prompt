/**
 * The DPL insert control that sits above the prompt box: a single **Insert ▾** button that opens a
 * menu. The menu first lists the categories (Chance, Choose, Repeat, Structure, Flow, Emphasis,
 * Code); picking one drills into its constructs — name, one-line description, the literal syntax,
 * and a live re-rolling example where the output is meaningful — with a Back row to return. Picking
 * an item drops its snippet at the editor's cursor (via the editor's imperative `insertSnippet`).
 *
 * It's a teaching surface as much as an insert tool: the lax line grammar (conditions, choices,
 * calls, …) is hard to discover by typing, so this lays it out, organized and navigable. (It used
 * to be a full row of per-category buttons; collapsed to one button so it never wraps on narrow
 * screens and reads as a single clear action.)
 * @module gui/components/DplInsertBar
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getDplInserts } from "../lib/dpl/dplInserts.js";
import { expandPrompt } from "../lib/promptEngine.js";

const msgs = defineMessages({
  toolbar: { id: "dplInsertBar.toolbar", defaultMessage: "Insert DPL syntax" },
  insert: { id: "dplInsertBar.insert", defaultMessage: "Insert" },
  example: { id: "dplInsertBar.example", defaultMessage: "example" },
});

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
  const intl = useIntl();
  const DPL_INSERTS = useMemo(() => getDplInserts(intl), [intl]);
  const [open, setOpen] = useState(false); // whole Insert menu open?
  const [activeCat, setActiveCat] = useState(null); // drilled-into category key, or null (list)
  const [examples, setExamples] = useState({}); // item id -> rolled example (for the open category)
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const openCat = DPL_INSERTS.find((c) => c.key === activeCat) || null;

  const close = () => {
    setOpen(false);
    setActiveCat(null);
  };

  // While a category is open, re-roll its items' live examples every second.
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

  // Escape backs out of a category first, then closes the menu.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (activeCat) setActiveCat(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeCat]);

  const pick = (item) => {
    editorRef?.current?.insertSnippet?.(item.template, { line: item.line, wrap: item.wrap });
    close();
  };

  return (
    <div className="dpl-insert-bar" role="toolbar" aria-label={intl.formatMessage(msgs.toolbar)}>
      <div className="dpl-ins-wrap">
        <button
          type="button"
          className={`dpl-ins-btn dpl-ins-main${open ? " on" : ""}`}
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {intl.formatMessage(msgs.insert)}
          <span className="dpl-ins-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <div className="dpl-ins-pop" role="menu" aria-label={intl.formatMessage(msgs.insert)}>
            {!openCat ? (
              // Level 1: the category list.
              DPL_INSERTS.map((cat) => (
                <button
                  type="button"
                  className="dpl-ins-cat"
                  role="menuitem"
                  key={cat.key}
                  onClick={() => setActiveCat(cat.key)}
                  aria-haspopup="menu"
                >
                  <span className="dpl-ins-cat-text">
                    <span className="dpl-ins-cat-name">{cat.label}</span>
                    <span className="dpl-ins-cat-hint">{cat.hint}</span>
                  </span>
                  <span className="dpl-ins-cat-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))
            ) : (
              // Level 2: the chosen category's constructs, with a Back row.
              <>
                <button type="button" className="dpl-ins-back" onClick={() => setActiveCat(null)}>
                  <span aria-hidden="true">‹</span> {openCat.label}
                </button>
                {openCat.items.map((it) => (
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
                        <span className="dpl-ins-item-ex-label">
                          {intl.formatMessage(msgs.example)}
                        </span>
                        <span className="dpl-ins-item-ex-text">{examples[it.id] ?? "…"}</span>
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {open && <div className="dpl-ins-scrim" onClick={close} aria-hidden="true" />}
      </div>
    </div>
  );
}
