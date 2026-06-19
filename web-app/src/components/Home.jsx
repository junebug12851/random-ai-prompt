/**
 * The Home composer — a focused two-pane prompt workspace. The left pane is the
 * building-block cloud (keywords, lists, expansions, dynamic prompts); the right
 * pane is the composer: prompt box with a rotating random suggestion, generate /
 * random / preview / share actions, the generated-prompt list, and save-expansion.
 *
 * Temporarily removed (see notes/plans/removed-pending-readd.md): image
 * generation, the chaos knob, and presets (apply + save).
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const blocks = useMemo(() => getBlocks(), [version]);

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });
  const set = (patch) => setSettings({ ...settings, ...patch });

  const animeOn = settings.keywordsFilename === "d-keyword" && settings.artistFilename === "d-artist";
  const normalOn = settings.keywordsFilename === "keyword" && settings.artistFilename === "artist";

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

  // Open the share panel: build the link, reveal it, and try to copy it. The
  // link stays visible either way, so it works even if the clipboard is blocked.
  function openShare() {
    const url = shareUrl(settings);
    setShareLink(url);
    setShareOpen(true);
    copyLink(url);
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
          <textarea
            className="prompt-input"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={suggestion ? `Try: ${suggestion}` : "Type a prompt, or use the building blocks on the left…"}
          />

          <div className="row actions">
            <button className="primary icon-btn" onClick={buildPrompts}>
              ✦ Generate prompt{settings.promptCount > 1 ? "s" : ""}
            </button>
            <button className="icon-btn" onClick={useSuggestion} title="Drop the current suggestion into the box" disabled={!suggestion}>
              🎲 Random
            </button>
            {prompt && (
              <button className="ghost" onClick={() => setPrompt("")}>
                Clear
              </button>
            )}
            <button
              className={`ghost${shareOpen ? " on" : ""}`}
              onClick={() => (shareOpen ? setShareOpen(false) : openShare())}
              title="Get a link that restores your current settings"
            >
              Share link
            </button>
            <div className="grow" />
            <div className="style-toggle">
              <span className="style-label">
                Style
                <span
                  className="help"
                  tabIndex={0}
                  role="img"
                  aria-label="Style help"
                  title="Swaps the word lists the random generator pulls from. Normal = general art styles + real-world artists. Anime = danbooru-style anime tags + anime artists. Only affects the random parts — not text you type."
                >
                  ?
                </span>
              </span>
              <div className="seg">
                <button className={normalOn ? "on" : ""} onClick={() => set({ keywordsFilename: "keyword", artistFilename: "artist" })}>
                  Normal
                </button>
                <button className={animeOn ? "on" : ""} onClick={() => set({ keywordsFilename: "d-keyword", artistFilename: "d-artist" })}>
                  Anime
                </button>
              </div>
            </div>
          </div>

          {shareOpen && (
            <div className="share-panel">
              <i className="share-icon" aria-hidden="true">
                🔗
              </i>
              <input
                className="share-url"
                readOnly
                value={shareLink}
                onFocus={(e) => e.target.select()}
                aria-label="Shareable link that restores these settings"
              />
              <button className="primary" onClick={() => copyLink()}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button className="ghost icon-btn" onClick={() => setShareOpen(false)} aria-label="Close share panel">
                ✕
              </button>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        {prompts.length > 0 && (
          <section className="card">
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

        {/* ---- Save ---- */}
        <section className="card">
          <div className="row save-row">
            <input placeholder="Save prompt as expansion…" value={expName} onChange={(e) => setExpName(e.target.value)} />
            <button onClick={saveExpansion} disabled={!expName.trim() || !prompt.trim()}>
              Save expansion
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
