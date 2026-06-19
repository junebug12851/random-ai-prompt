/**
 * The Home composer — the single workspace that supersedes the old separate Build and
 * Generate tabs. It pairs prompt composition (block cloud, live preview, share link,
 * word toggles, chaos, save expansion / preset) with image generation (provider line,
 * generate prompts / images, in-session gallery) on one page, styled after the
 * pre-revival generate screen.
 * @module web-app/components/Home
 */
import { useMemo, useState } from "react";
import { Select } from "./Field.jsx";
import Gallery from "./Gallery.jsx";
import { getBlocks, getPresetNames, loadPreset, expandPrompt, generatePrompts } from "../lib/promptEngine.js";
import { saveCustomExpansion, saveCustomPreset } from "../lib/customStore.js";
import { getProvider } from "../lib/providers/index.js";
import { shareUrl } from "../lib/share.js";

/**
 * The unified compose-and-generate workspace.
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
export default function Home({ settings, setSettings }) {
  const [version, setVersion] = useState(0); // bump to refresh custom blocks/presets
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("");
  const [preview, setPreview] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [expName, setExpName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const blocks = useMemo(() => getBlocks(), [version]);
  const presetNames = useMemo(() => getPresetNames(), [version]);

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });
  const set = (patch) => setSettings({ ...settings, ...patch });

  const provider = getProvider(settings.provider);
  const hasKey = !provider.needsKey || !!settings.keys?.[provider.id];
  const animeOn = settings.keywordsFilename === "d-keyword" && settings.artistFilename === "d-artist";
  const normalOn = settings.keywordsFilename === "keyword" && settings.artistFilename === "artist";

  function insert(token) {
    const sep = prompt && !/\s$/.test(prompt) ? ", " : "";
    setPrompt(`${prompt}${sep}${token}`);
  }

  function surprise() {
    setError("");
    setPreview("");
    setImages([]);
    setPrompts(generatePrompts({ ...settings, prompt: "#random" }));
  }

  function buildPrompts() {
    setError("");
    setImages([]);
    setPrompts(generatePrompts(settings));
  }

  async function generateImages() {
    setError("");
    setBusy(true);
    setImages([]);
    try {
      const list = prompts.length ? prompts : generatePrompts(settings);
      setPrompts(list);
      if (!hasKey) throw new Error(`${provider.label} needs an API key — add one in Settings.`);
      const key = settings.keys?.[provider.id] || "";
      const all = [];
      for (const p of list) {
        const { images: imgs } = await provider.generate({ prompt: p, settings, key });
        all.push(...imgs);
      }
      setImages(all);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function applyPreset() {
    if (preset) set(loadPreset(preset));
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

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    // Capture the knobs, not the prompt / backend / secrets.
    const { keys, prompt: _p, provider: _pr, localWebuiUrl, chaos, ...patch } = settings;
    saveCustomPreset(name, patch);
    setPresetName("");
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
    <div className="stack">
      {/* ---- Composer ---- */}
      <section className="card composer">
        <label className="field">
          <span>Prompt</span>
          <textarea
            className="prompt-input"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="#random — or compose with the building blocks below"
          />
        </label>

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

          <label className="chaos" title="Scales emphasis / alternating intensity">
            Chaos
            <input type="number" step="0.25" min="0" value={settings.chaos ?? 1} onChange={(e) => set({ chaos: Number(e.target.value) })} />
          </label>

          <div className="grow" />

          <div className="inline-select">
            <Select
              value={preset}
              onChange={setPreset}
              options={[{ value: "", label: "Apply preset…" }, ...presetNames.map((p) => ({ value: p, label: p }))]}
            />
            <button onClick={applyPreset} disabled={!preset}>
              Apply
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

      {/* ---- Generate to images ---- */}
      <section className="card">
        <div className="row">
          <span className="hint">
            Render with <span className="accent">{provider.label}</span>
            {provider.local && " (your machine)"}
            {!hasKey && " — no key set"}
          </span>
          <div className="grow" />
          <button className="primary" onClick={generateImages} disabled={busy}>
            {busy ? "Generating…" : "🖼 Generate images"}
          </button>
        </div>

        {prompts.length > 0 && (
          <>
            <div className="results-head" style={{ marginTop: "1rem" }}>
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
          </>
        )}

        {images.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <Gallery images={images} />
          </div>
        )}
      </section>

      {/* ---- Save ---- */}
      <section className="card">
        <div className="row save-row">
          <input placeholder="Save prompt as expansion…" value={expName} onChange={(e) => setExpName(e.target.value)} />
          <button onClick={saveExpansion} disabled={!expName.trim() || !prompt.trim()}>
            Save expansion
          </button>
          <div className="grow" />
          <input placeholder="Save settings as preset…" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button onClick={savePreset} disabled={!presetName.trim()}>
            Save preset
          </button>
        </div>
      </section>

      {/* ---- Building blocks ---- */}
      <section className="card">
        <div className="blocks-head">
          <h3 className="section-title">Building blocks</h3>
          <input className="picker-filter" placeholder="Search keywords, lists, expansions…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

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
      </section>
    </div>
  );
}
