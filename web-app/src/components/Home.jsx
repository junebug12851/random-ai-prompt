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
import { getBlocks, generatePrompt, generatePrompts } from "../lib/promptEngine.js";
import { saveCustomExpansion } from "../lib/customStore.js";
import { shareUrl } from "../lib/share.js";

const SUGGESTION_MS = 5000; // how often the rotating random suggestion refreshes

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
  const [expName, setExpName] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [panelOpen, setPanelOpen] = useState(false); // the combined Save / Share panel
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

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
        setSuggestion(generatePrompt({ ...settingsRef.current, prompt: "#random" }));
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

  // Random drops the currently-shown suggestion into the prompt box.
  function useSuggestion() {
    if (suggestion) setPrompt(suggestion);
  }

  // Generate from whatever is typed; if the box is empty, fall back to the
  // current suggestion (or a fresh random roll) so it's never a no-op.
  function buildPrompts() {
    setError("");
    try {
      const base = prompt && prompt.trim() ? settings : { ...settings, prompt: suggestion || "#random" };
      setPrompts(generatePrompts(base));
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // The combined Save / Share panel. Opening it builds a fresh share link so it's
  // ready to copy; the link stays visible even if the clipboard is blocked.
  function togglePanel() {
    if (panelOpen) {
      setPanelOpen(false);
    } else {
      setShareLink(shareUrl(settings));
      setPanelOpen(true);
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
    setPanelOpen(false);
    setVersion((v) => v + 1);
  }

  function copyPrompt(p) {
    navigator.clipboard?.writeText(p).catch(() => {});
  }

  // Filter blocks by the single search box (matches token or label).
  const q = query.trim().toLowerCase();
  const filtered = blocks
    .map((b) => ({
      ...b,
      items: q ? b.items.filter((i) => i.token.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)) : b.items,
    }))
    .filter((b) => b.items.length);

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
              {filtered.map((b) => (
                <button
                  key={b.title}
                  className={`cat-tab${active && active.title === b.title ? " on" : ""}`}
                  onClick={() => setActiveCat(b.title)}
                >
                  <span className="cat-name">{b.title}</span>
                  <span className="count-pill">{b.items.length}</span>
                </button>
              ))}
            </nav>

            <div className="chip-area">
              {active && active.hint && <p className="cat-hint">{active.hint}</p>}
              <div className="picker-list">
                {activeItems.slice(0, 400).map((i) => (
                  <button key={i.token} className="chip" title={i.token} onClick={() => insert(i.token)}>
                    {i.label}
                  </button>
                ))}
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
              <button
                className={`field-util${panelOpen ? " on" : ""}`}
                onClick={togglePanel}
                title="Save this prompt as an expansion, or get a shareable link"
              >
                Save / Share
              </button>

              <div className="grow" />

              <button className="field-act" onClick={useSuggestion} disabled={!suggestion} title="Random — drop a suggestion in" aria-label="Random suggestion">
                🎲
              </button>
              <button
                className="field-act primary"
                onClick={buildPrompts}
                title={`Generate prompt${settings.promptCount > 1 ? "s" : ""}`}
                aria-label="Generate prompt"
              >
                ✦
              </button>
            </div>
          </div>

          {/* Combined Save / Share panel, opened from the field bar */}
          {panelOpen && (
            <div className="action-panel">
              <div className="ap-row">
                <i className="panel-icon" aria-hidden="true">
                  ✎
                </i>
                <input
                  className="panel-input"
                  placeholder="Save this prompt as a reusable expansion…"
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
              <div className="ap-row">
                <i className="panel-icon" aria-hidden="true">
                  🔗
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
    </div>
  );
}
