import { useMemo, useState } from "react";
import { Select } from "./Field.jsx";
import { getBlocks, getPresetNames, loadPreset, expandPrompt } from "../lib/promptEngine.js";
import { saveCustomExpansion, saveCustomPreset } from "../lib/customStore.js";
import { shareUrl } from "../lib/share.js";

// Compose a prompt from building blocks, presets and quick controls — the
// browser-native version of the original generate screen's prompt tools.
export default function Builder({ settings, setSettings }) {
  const [version, setVersion] = useState(0); // bump to refresh custom blocks/presets
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("");
  const [preview, setPreview] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [expName, setExpName] = useState("");
  const [presetName, setPresetName] = useState("");

  const blocks = useMemo(() => getBlocks(), [version]);
  const presetNames = useMemo(() => getPresetNames(), [version]);

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });
  const set = (patch) => setSettings({ ...settings, ...patch });

  function insert(token) {
    const sep = prompt && !/\s$/.test(prompt) ? ", " : "";
    setPrompt(`${prompt}${sep}${token}`);
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
    const { keys, prompt: _p, provider, localWebuiUrl, chaos, ...patch } = settings;
    saveCustomPreset(name, patch);
    setPresetName("");
    setVersion((v) => v + 1);
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
    <div className="builder">
      <label className="field">
        <span>Prompt</span>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="#random" />
      </label>

      <div className="row">
        <button onClick={() => setPrompt("#random")}>🎲 Surprise me</button>
        <button onClick={() => setPreview(expandPrompt(prompt, settings))}>Preview expansion</button>
        <button className="ghost" onClick={() => setPrompt("")}>
          Clear
        </button>
        <button className="ghost" onClick={share}>
          Share link
        </button>
        {shareMsg && <span className="hint">{shareMsg}</span>}
      </div>

      <div className="row">
        <button
          className="ghost"
          title="Use the danbooru anime keyword + artist lists"
          onClick={() => set({ keywordsFilename: "d-keyword", artistFilename: "d-artist" })}
        >
          Anime words
        </button>
        <button
          className="ghost"
          title="Use the normal keyword + artist lists"
          onClick={() => set({ keywordsFilename: "keyword", artistFilename: "artist" })}
        >
          Normal words
        </button>
        <label className="field field-toggle" title="Scales emphasis/alternating intensity">
          <span>Chaos</span>
          <input
            type="number"
            step="0.25"
            min="0"
            style={{ width: "5rem" }}
            value={settings.chaos ?? 1}
            onChange={(e) => set({ chaos: Number(e.target.value) })}
          />
        </label>
        <div className="grow" />
        <Select
          value={preset}
          onChange={setPreset}
          options={[{ value: "", label: "Apply preset…" }, ...presetNames.map((p) => ({ value: p, label: p }))]}
        />
        <button onClick={applyPreset} disabled={!preset}>
          Apply
        </button>
      </div>

      {preview && (
        <div className="preview">
          <div className="preview-label">expands to</div>
          <div className="preview-body">{preview}</div>
        </div>
      )}

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

      <input className="picker-filter" placeholder="Search building blocks…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="blocks">
        {filtered.map((b) => (
          <section key={b.title} className="block">
            <h3 title={b.hint}>
              {b.title} <em>{b.items.length}</em>
            </h3>
            <div className="picker-list">
              {b.items.slice(0, 300).map((i) => (
                <button key={i.token} className="chip" title={i.token} onClick={() => insert(i.token)}>
                  {i.label}
                </button>
              ))}
              {b.items.length > 300 && <span className="picker-more">+{b.items.length - 300} more — keep typing</span>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
