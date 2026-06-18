import { useState } from "react";
import Gallery from "./Gallery.jsx";
import { generatePrompts } from "../lib/promptEngine.js";
import { getProvider } from "../lib/providers/index.js";

// Run generation: build the prompt(s) client-side, then (optionally) send each to
// the selected provider for an image. Results are in-session only.
export default function Generate({ settings, setSettings }) {
  const [prompts, setPrompts] = useState([]);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const provider = getProvider(settings.provider);
  const hasKey = !provider.needsKey || !!settings.keys?.[provider.id];

  function onPrompts() {
    setError("");
    setImages([]);
    setPrompts(generatePrompts(settings));
  }

  async function onImages() {
    setError("");
    setBusy(true);
    setImages([]);
    try {
      const list = prompts.length ? prompts : generatePrompts(settings);
      setPrompts(list);
      if (!hasKey) throw new Error("This provider needs an API key — add one in Settings.");
      const key = settings.keys?.[provider.id] || "";
      const all = [];
      for (const prompt of list) {
        const { images: imgs } = await provider.generate({ prompt, settings, key });
        all.push(...imgs);
      }
      setImages(all);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="generate">
      <label className="field">
        <span>Prompt</span>
        <textarea
          rows={2}
          value={settings.prompt}
          onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
          placeholder="#random"
        />
      </label>

      <div className="row">
        <span className="hint">
          via {provider.label}
          {!hasKey && " — no key set"}
        </span>
        <div className="grow" />
        <button onClick={onPrompts}>Generate prompts</button>
        <button onClick={onImages} disabled={busy}>
          {busy ? "Generating…" : "Generate images"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {prompts.length > 0 && (
        <ul className="prompts">
          {prompts.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      <Gallery images={images} />
    </div>
  );
}
