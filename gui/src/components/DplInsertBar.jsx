/**
 * The DPL insert control above the prompt box. It teaches + inserts the lax line grammar (conditions,
 * choices, calls, weights, …) that's hard to discover by typing: each construct shows its name, a
 * one-line description, the literal syntax, and a live re-rolling example; picking one drops its
 * snippet at the editor's cursor (via the editor's imperative `insertSnippet`).
 *
 * Two presentations, chosen by width (a hydration-safe media-query hook — the DESKTOP row renders
 * from first paint, unchanged):
 *   • Desktop (>768px): the original slim ROW of per-category buttons, each opening its own popover.
 *   • Compact (<=768px): a single **Insert ▾** button opening a menu — category list → drill into a
 *     category's constructs with a Back row — so it never wraps on a narrow screen.
 * @module gui/components/DplInsertBar
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getDplInserts } from "../lib/dpl/dplInserts.js";
import { expandPrompt } from "../lib/promptEngine.js";
import { useCompact } from "../lib/useCompact.js";

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

/** Live-rolling examples for the currently-open category (keyed by item id). */
function useExamples(openCat, settings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [examples, setExamples] = useState({});
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
  return examples;
}

/** One construct row (name + description + syntax + live example). Shared by both presentations. */
function ItemButton({ item, example, intl, onPick }) {
  return (
    <button type="button" className="dpl-ins-item" role="menuitem" onClick={() => onPick(item)}>
      <span className="dpl-ins-item-head">
        <span className="dpl-ins-item-name">{item.label}</span>
      </span>
      <span className="dpl-ins-item-desc">{item.desc}</span>
      <code className="dpl-ins-item-syntax">{item.syntax}</code>
      {item.example && (
        <span className="dpl-ins-item-ex">
          <span className="dpl-ins-item-ex-label">{intl.formatMessage(msgs.example)}</span>
          <span className="dpl-ins-item-ex-text">{example ?? "…"}</span>
        </span>
      )}
    </button>
  );
}

/** Desktop (>768px): the original row of per-category buttons, each with its own popover. */
function InsertRow({ inserts, intl, settings, onPick }) {
  const [open, setOpen] = useState(null); // open category key, or null
  const openCat = inserts.find((c) => c.key === open) || null;
  const examples = useExamples(openCat, settings);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (item) => {
    onPick(item);
    setOpen(null);
  };

  return (
    <div className="dpl-insert-bar" role="toolbar" aria-label={intl.formatMessage(msgs.toolbar)}>
      <span className="dpl-insert-lead">{intl.formatMessage(msgs.insert)}</span>
      {inserts.map((cat, idx) => (
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
              className={`dpl-ins-pop${idx >= inserts.length - 2 ? " dpl-ins-pop-right" : ""}`}
              role="menu"
              aria-label={cat.label}
            >
              <div className="dpl-ins-pop-hint">{cat.hint}</div>
              {cat.items.map((it) => (
                <ItemButton key={it.id} item={it} example={examples[it.id]} intl={intl} onPick={pick} />
              ))}
            </div>
          )}
        </div>
      ))}
      {open && <div className="dpl-ins-scrim" onClick={() => setOpen(null)} aria-hidden="true" />}
    </div>
  );
}

/** Compact (<=768px): a single Insert button opening a category list → drill-into-items menu. */
function InsertMenu({ inserts, intl, settings, onPick }) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const openCat = inserts.find((c) => c.key === activeCat) || null;
  const examples = useExamples(openCat, settings);

  const close = () => {
    setOpen(false);
    setActiveCat(null);
  };

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
    onPick(item);
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
              inserts.map((cat) => (
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
              <>
                <button type="button" className="dpl-ins-back" onClick={() => setActiveCat(null)}>
                  <span aria-hidden="true">‹</span> {openCat.label}
                </button>
                {openCat.items.map((it) => (
                  <ItemButton key={it.id} item={it} example={examples[it.id]} intl={intl} onPick={pick} />
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

/**
 * @param {object} props
 * @param {import("react").RefObject} props.editorRef Ref to the prompt {@link DplEditor} (for insertSnippet).
 * @param {object} props.settings Generation settings (for SFW/NSFW-correct live examples).
 * @returns {JSX.Element}
 */
export default function DplInsertBar({ editorRef, settings }) {
  const intl = useIntl();
  const inserts = useMemo(() => getDplInserts(intl), [intl]);
  const compact = useCompact();

  const pick = (item) =>
    editorRef?.current?.insertSnippet?.(item.template, { line: item.line, wrap: item.wrap });

  const shared = { inserts, intl, settings, onPick: pick };
  return compact ? <InsertMenu {...shared} /> : <InsertRow {...shared} />;
}
