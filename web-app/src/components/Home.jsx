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
import { getBlocks, expandPrompt, generatePrompt, generatePrompts } from "../lib/promptEngine.js";
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
  const [preview, setPreview] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [expName, setExpName] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");

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

  function surprise() {
    setError("");
    setPreview("");
    setPrompts(generatePrompts({ ...settings, prompt: "#random" }));
  }

  function buildPrompts() {
    setError("");
    try {
      setPrompts(generatePrompts(settings));
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(shareUrl(settings));
      setShareMsg("Link copied!");
    } catch {
      setShareMsg("Copy failed — check clipboard permissions");
    }
    setTimeout(() => setShareMsg(""), 2500);
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

  return (
    <div className="workspace">
      {/* ---- Left pane: building blocks ---- */}
      <aside className="sidebar card">
        <div className="blocks-head">
          <h3 className="section-title">Building blocks</h3>
        </div>
        <input className="picker-filter" placeholder="Search keywords, lists, expansions…" value={query} onChange={(e) => setQuery(e.target.value)} />

        {filtered.length === 0 ? (
          <p className="empty">No building blocks match “{query}”.</p>
        ) : (
          <div className="blocks">
            {filtered.map((b, idx) => (
              <details key={b.title} className="block" open={idx === 0 || !!q}>
                <summary>
                  {b.title}
                  {b.hint && <span className="tag">— {b.hint}</span>}
                  <span className="count-pill">{b.items.length}</span>
                </summary>
                <div className="picker-list">
                  {b.items.slice(0, 300).map((i) => (
                    <button key={i.token} className="chip" title={i.token} onClick={() => insert(i.token)}>
                      {i.label}
                    </button>
                  ))}
                  {b.items.length > 300 && <span className="picker-more">+{b.items.length - 300} more — keep typing</span>}
                </div>
              </details>
            ))}
          </div>
        )}
      </aside>

      {/* ---- Right pane: composer ---- */}
      <div className="main-col">
        <section className="card composer">
          <label className="field">
            <span>Prompt</span>
            <textarea
              className="prompt-input"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="#random — or compose with the building blocks on the left"
            />
          </label>

          {suggestion && (
            <button className="suggestion" onClick={() => setPrompt(suggestion)} title="Use this random suggestion">
              <span className="suggestion-label">Try</span>
              <span className="suggestion-text">{suggestion}</span>
            </button>
          )}

          <div className="row actions">
            <button className="primary icon-btn" onClick={buildPrompts}>
              ✦ Generate prompt{settings.promptCount > 1 ? "s" : ""}
            </button>
            <button className="icon-btn" onClick={surprise} title="Generate from a random search suggestion">
              🎲 Random
            </button>
            <button className="ghost" onClick={() => setPreview(expandPrompt(prompt, settings))} title="Show what this prompt expands to">
              Preview
            </button>
            <div className="grow" />
            <button className="ghost" onClick={share} title="Copy a link that restores these settings">
              Share link
            </button>
            {prompt && (
              <button className="ghost" onClick={() => setPrompt("")}>
                Clear
              </button>
            )}
          </div>

          {shareMsg && <p className="hint share-msg">{shareMsg}</p>}

          {/* ---- Quick controls ---- */}
          <div className="row controls">
            <div className="seg" title="Pick the keyword + artist word lists">
              <button className={normalOn ? "on" : ""} onClick={() => set({ keywordsFilename: "keyword", artistFilename: "artist" })}>
                Normal
              </button>
              <button className={animeOn ? "on" : ""} onClick={() => set({ keywordsFilename: "d-keyword", artistFilename: "d-artist" })}>
                Anime
              </button>
            </div>
          </div>

          {preview && (
            <div className="preview">
              <div className="preview-label">expands to</div>
              <div className="preview-body">{preview}</div>
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
