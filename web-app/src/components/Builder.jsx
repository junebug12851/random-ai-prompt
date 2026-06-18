import { useState } from "react";
import TokenPicker from "./TokenPicker.jsx";
import { Select } from "./Field.jsx";
import { catalog, loadPreset } from "../lib/catalog.js";
import { expandPrompt } from "../lib/promptEngine.js";

const TABS = [
  { id: "dynamic", label: `Dynamic #`, tokens: catalog.dynamicPrompts },
  { id: "lists", label: `Lists {}`, tokens: catalog.lists },
  { id: "expansions", label: `Expansions <>`, tokens: catalog.expansions },
];

// Compose a prompt: insert dynamic prompts / lists / expansions, apply a preset,
// roll a random one, and preview what it expands to — all client-side.
export default function Builder({ settings, setSettings }) {
  const [tab, setTab] = useState("dynamic");
  const [preset, setPreset] = useState("");
  const [preview, setPreview] = useState("");

  const prompt = settings.prompt;
  const setPrompt = (p) => setSettings({ ...settings, prompt: p });

  function insert(token) {
    const sep = prompt && !/\s$/.test(prompt) ? ", " : "";
    setPrompt(`${prompt}${sep}${token}`);
  }
  function applyPreset() {
    if (preset) setSettings({ ...settings, ...loadPreset(preset) });
  }

  const activeTokens = TABS.find((t) => t.id === tab).tokens;

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
        <div className="grow" />
        <Select
          value={preset}
          onChange={setPreset}
          options={[{ value: "", label: "Apply preset…" }, ...catalog.presets.map((p) => ({ value: p, label: p }))]}
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

      <div className="picker-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label} <em>{t.tokens.length}</em>
          </button>
        ))}
      </div>
      <TokenPicker tokens={activeTokens} onInsert={insert} />
    </div>
  );
}
