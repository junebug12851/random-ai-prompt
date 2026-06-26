/**
 * The Home composer — a focused two-pane prompt workspace. The left pane is the
 * building-block cloud (keywords, lists, expansions, dynamic prompts); the right
 * pane is an editor-style composer: a prompt box that fills its space with a
 * rotating random suggestion, a compact action toolbar (generate / random /
 * clear / save / share), inline save + share panels, and the generated-prompt
 * list.
 *
 * Temporarily removed (see notes/plans/removed-pending-readd.md): image
 * generation, the chaos knob, presets, and the Normal/Anime style toggle (the
 * anime word lists mix SFW + explicit adult tags and need a proper split first).
 * @module web-app/components/Home
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getBlocks, generatePrompt, renderWrapperPart, expandPrompt } from "../lib/promptEngine.js";
import { saveCustomExpansion } from "../lib/customStore.js";
import { getDefaultWrapper } from "../lib/wrapperStore.js";
import { shareUrl } from "../lib/share.js";
import WrapperButton from "./WrapperFab.jsx";

const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes

// Crisp monochrome action icons (stroke = currentColor) so the four field
// buttons read as one cohesive set.
const ico = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const SaveIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);
const ShareIcon = () => (
  <svg {...ico} aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const ShuffleIcon = () => (
  <svg {...ico} aria-hidden="true">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);
const SparkleIcon = () => (
  <svg {...ico} fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" />
    <path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </svg>
);

/**
 * The compose workspace.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Home({ settings, setSettings }) {
  const [version, setVersion] = useState(0); // bump to refresh custom blocks
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [dynVer, setDynVer] = useState("v3"); // "v3" (default) | "v2" | "v1" superset for the dynamic blocks
  const [expName, setExpName] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [panel, setPanel] = useState(""); // "" | "save" | "share"
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  // Hover tooltip for a building block: its label, description (piped from the v3 file /
  // sidecar), and a LIVE example output that re-rolls while the pointer rests on the chip.
  const [tip, setTip] = useState(null); // { token, label, description, x, y }
  const [tipEx, setTipEx] = useState("");

  const blocks = useMemo(() => getBlocks(), [version]);

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });

  // A fresh random prompt suggestion that cycles every few seconds. The latest
  // settings live in a ref so the interval reads current word lists without
  // resetting its timer on every keystroke.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const roll = () => {
      try {
        setSuggestion(generatePrompt({ ...settingsRef.current, prompt: "{#random-words}" }));
      } catch {
        /* engine not ready — skip this tick */
      }
    };
    roll();
    const id = setInterval(roll, SUGGESTION_MS);
    return () => clearInterval(id);
  }, []);

  function insert(token) {
    const sep = prompt && !/\s$/.test(prompt) ? ", " : "";
    setPrompt(`${prompt}${sep}${token}`);
  }

  // --- Building-block hover tooltip (label + description + a refreshing example) ---
  const showTip = (item, e) =>
    setTip({ token: item.token, label: item.label, description: item.description, x: e.clientX, y: e.clientY });
  const moveTip = (e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const hideTip = () => setTip(null);

  // While a tip is shown, expand its token into a fresh example, re-rolling on an interval.
  // Examples are rendered WITHOUT the auto fx/artists framing so they show just the block.
  const tipToken = tip?.token;
  useEffect(() => {
    if (!tipToken) {
      setTipEx("");
      return undefined;
    }
    const roll = () => {
      try {
        setTipEx(expandPrompt(tipToken, { ...settingsRef.current, autoAddFx: false, autoAddArtists: false }));
      } catch {
        setTipEx("");
      }
    };
    roll();
    const id = setInterval(roll, 1400);
    return () => clearInterval(id);
  }, [tipToken]);

  // Random drops the currently-shown suggestion into the prompt box.
  function useSuggestion() {
    if (suggestion) setPrompt(suggestion);
  }

  // Generate from whatever is typed; if the box is empty, fall back to the
  // current suggestion (or a fresh random roll) so it's never a no-op.
  function buildPrompts() {
    setError("");
    try {
      // Frame each prompt with the active wrapper (start, your prompt, end) — the v3 root layer.
      // The wrapper boxes are DPL, so render them (probability/bullets) per prompt before joining.
      const text = prompt && prompt.trim() ? prompt : suggestion || "{#random-words}";
      // The Default wrapper is read live (so edits to it apply); a chosen named/None wrapper uses
      // its stored snapshot.
      const w =
        !settings.wrapperName || settings.wrapperName === "Default"
          ? getDefaultWrapper()
          : settings.wrapper ?? getDefaultWrapper();
      const count = Math.max(1, Number(settings.promptCount) || 1);
      // Whether blocks may contribute their own `Auto Begin` / `Auto End` framing (default on). When
      // off, only the user wrapper (or None) frames the prompt — no input from any block.
      const useAuto = settings.useAutoSections !== false;
      const out = [];
      for (let i = 0; i < count; i++) {
        const wrapped = [renderWrapperPart(w.start, settings), text, renderWrapperPart(w.end, settings)]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(", ");
        const sink = { begin: [], end: [] };
        const result = generatePrompt({ ...settings, prompt: wrapped, autoSink: useAuto ? sink : null });
        // Fold each fired block's Auto Begin / Auto End into the prompt's start / end.
        const framed = useAuto
          ? [sink.begin.join(", "), result, sink.end.join(", ")].map((s) => s.trim()).filter(Boolean).join(", ")
          : result;
        out.push(framed);
      }
      setPrompts(out);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  function toggleSave() {
    setPanel((p) => (p === "save" ? "" : "save"));
  }
  // Opening Share builds a fresh link so it's ready to copy; the link stays
  // visible even if the clipboard is blocked.
  function toggleShare() {
    if (panel === "share") {
      setPanel("");
    } else {
      setShareLink(shareUrl(settings));
      setPanel("share");
    }
  }
  async function copyLink(url = shareLink) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // leave the link visible for manual copy
    }
  }

  function saveExpansion() {
    const name = expName.trim();
    if (!name || !prompt.trim()) return;
    saveCustomExpansion(name, prompt);
    setExpName("");
    setPanel("");
    setVersion((v) => v + 1);
  }

  function copyPrompt(p) {
    navigator.clipboard?.writeText(p).catch(() => {});
  }

  // Filter blocks by the single search box (matches token or label). Category pills
  // (the Lists folder headers) are kept only when a following entry survives.
  const q = query.trim().toLowerCase();
  const matchItem = (i) =>
    (i.token || "").toLowerCase().includes(q) || (i.label || "").toLowerCase().includes(q);
  function filterItems(items) {
    if (!q) return items;
    const out = [];
    for (let k = 0; k < items.length; k++) {
      const i = items[k];
      if (i.category) {
        let any = false;
        for (let j = k + 1; j < items.length && !items[j].category; j++)
          if (matchItem(items[j])) {
            any = true;
            break;
          }
        if (any) out.push(i);
      } else if (matchItem(i)) {
        out.push(i);
      }
    }
    return out;
  }
  // Dynamic blocks carry v2/v1 variants; pick the one the navbar superset link selects.
  const effItems = (b) => (b.dynVersioned ? b.variants[dynVer] || [] : b.items);
  const filtered = blocks
    .map((b) => ({ ...b, items: filterItems(effItems(b)) }))
    .filter((b) => b.items.some((i) => !i.category));

  // The active category (falls back to the first available when the current
  // selection is filtered away or unset).
  const active = filtered.find((b) => b.title === activeCat) || filtered[0] || null;
  const activeItems = active ? active.items : [];

  return (
    <div className="workspace">
      {/* ---- Left panel: building-block palette ---- */}
      <aside className="sidebar">
        <div className="panel-head">
          <h3 className="panel-title">Building blocks</h3>
          <input className="picker-filter" placeholder="Search blocks…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <p className="empty">No building blocks match “{query}”.</p>
        ) : (
          <>
            <nav className="cat-tabs">
              {(() => {
                const rows = [];
                let headDone = false;
                for (const b of filtered) {
                  // A single "Prompts" heading (with the v1/v2 superset switch) precedes the
                  // full/partial sub-tabs; the sub-tabs are full-width rows, just indented.
                  if (b.dynVersioned && !headDone) {
                    headDone = true;
                    rows.push(
                      <div key="__prompts" className="cat-head">
                        <span className="cat-name">Blocks</span>
                        <span className="ver-links">
                          {["v1", "v2", "v3"].map((v) => (
                            <button
                              key={v}
                              className={`ver-link${dynVer === v ? " on" : ""}`}
                              title={
                                v === "v3"
                                  ? "Current generators (default)"
                                  : `Frozen legacy (${v}) generators`
                              }
                              onClick={() => setDynVer(v)}
                            >
                              {v}
                            </button>
                          ))}
                        </span>
                      </div>,
                    );
                  }
                  rows.push(
                    <button
                      key={b.title}
                      className={`cat-tab${b.dynVersioned ? " sub" : ""}${active && active.title === b.title ? " on" : ""}`}
                      onClick={() => setActiveCat(b.title)}
                    >
                      <span className="cat-name">{b.dynVersioned ? b.subLabel || b.title : b.title}</span>
                      <span className="count-pill">{b.items.filter((i) => !i.category).length}</span>
                    </button>,
                  );
                }
                return rows;
              })()}
            </nav>

            <div className="chip-area">
              {active && active.hint && <p className="cat-hint">{active.hint}</p>}
              <div className="picker-list">
                {activeItems.slice(0, 400).map((i, idx) =>
                  i.category ? (
                    i.token ? (
                      <button
                        key={`cat-${i.label}-${idx}`}
                        className="cat-pill cat-pill-group"
                        onMouseEnter={(e) => showTip(i, e)}
                        onMouseMove={moveTip}
                        onMouseLeave={hideTip}
                        onClick={() => insert(i.token)}
                      >
                        {i.label}
                      </button>
                    ) : (
                      <span key={`cat-${i.label}-${idx}`} className="cat-pill" title={i.description || i.label}>
                        {i.label}
                      </span>
                    )
                  ) : (
                    <button
                      key={i.token}
                      className="chip"
                      onMouseEnter={(e) => showTip(i, e)}
                      onMouseMove={moveTip}
                      onMouseLeave={hideTip}
                      onClick={() => insert(i.token)}
                    >
                      {i.label}
                    </button>
                  ),
                )}
                {activeItems.length > 400 && <span className="picker-more">+{activeItems.length - 400} more — keep typing to filter</span>}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ---- Right pane: composer ---- */}
      <div className="main-col">
        <section className="card composer">
          {/* The prompt box is a chat-style field: a textarea with the actions
              docked along its bottom edge. */}
          <div className="composer-field">
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={suggestion ? `Try: ${suggestion}` : "Type a prompt, or use the building blocks on the left…"}
            />
            {prompt && (
              <button className="clear-x" onClick={() => setPrompt("")} title="Clear the prompt" aria-label="Clear the prompt">
                ✕
              </button>
            )}

            <div className="field-bar">
              <div className="grow" />

              <WrapperButton settings={settings} setSettings={setSettings} />
              <button
                className={`field-act${panel === "save" ? " on" : ""}`}
                onClick={toggleSave}
                disabled={!prompt.trim()}
                title="Save as block"
                aria-label="Save as block"
                aria-pressed={panel === "save"}
              >
                <SaveIcon />
              </button>
              <button
                className={`field-act${panel === "share" ? " on" : ""}`}
                onClick={toggleShare}
                title="Share link"
                aria-label="Share link"
                aria-pressed={panel === "share"}
              >
                <ShareIcon />
              </button>
              <button className="field-act" onClick={useSuggestion} disabled={!suggestion} title="Random — drop a suggestion in" aria-label="Random suggestion">
                <ShuffleIcon />
              </button>
              <button
                className="field-act primary"
                onClick={buildPrompts}
                title={`Generate prompt${settings.promptCount > 1 ? "s" : ""}`}
                aria-label="Generate prompt"
              >
                <SparkleIcon />
              </button>
            </div>
          </div>

          {/* Save / Share panels, opened from the field bar */}
          {panel === "save" && (
            <div className="action-panel">
              <div className="ap-row">
                <i className="panel-icon" aria-hidden="true">
                  <SaveIcon />
                </i>
                <input
                  className="panel-input"
                  placeholder="Save this prompt as a reusable block…"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveExpansion()}
                  aria-label="Expansion name"
                  autoFocus
                />
                <button className="primary" onClick={saveExpansion} disabled={!expName.trim() || !prompt.trim()}>
                  Save
                </button>
              </div>
            </div>
          )}
          {panel === "share" && (
            <div className="action-panel">
              <div className="ap-row">
                <i className="panel-icon" aria-hidden="true">
                  <ShareIcon />
                </i>
                <input
                  className="panel-input"
                  readOnly
                  value={shareLink}
                  onFocus={(e) => e.target.select()}
                  aria-label="Shareable link that restores these settings"
                />
                <button className="primary" onClick={() => copyLink()}>
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        {prompts.length > 0 && (
          <section className="card results-card">
            <div className="results-head">
              <h2>Prompts</h2>
              <span className="count">{prompts.length} generated</span>
            </div>
            <ul className="prompts">
              {prompts.map((p, i) => (
                <li key={i}>
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  <span>{p}</span>
                  <button className="copy-mini" title="Copy" onClick={() => copyPrompt(p)}>
                    copy
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Hover tooltip for a building block — follows the pointer; shows a live, refreshing example.
          Flips above the cursor when there isn't room below so it can't clip off the bottom. */}
      {tip && (
        <div
          className="block-tip"
          style={(() => {
            const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
            const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
            const left = Math.max(8, Math.min(tip.x + 16, vw - 360));
            // If the pointer is in the lower part of the screen, anchor the tip's bottom above it.
            return tip.y > vh * 0.6
              ? { left, bottom: vh - tip.y + 18, maxHeight: tip.y - 16 }
              : { left, top: tip.y + 18, maxHeight: vh - tip.y - 28 };
          })()}
          role="tooltip"
        >
          <div className="block-tip-name">
            <span className="block-tip-label">{tip.label}</span>
            <code className="block-tip-token">{tip.token}</code>
          </div>
          {tip.description && <div className="block-tip-desc">{tip.description}</div>}
          {tipEx && (
            <div className="block-tip-ex">
              <span className="block-tip-ex-label">Example:</span> {tipEx}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
