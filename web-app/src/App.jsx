import { useState } from "react";
import { useSettings } from "./lib/settings.js";
import { generatePrompts } from "./lib/promptEngine.js";
import { availableProviders, getProvider, ONLINE } from "./lib/providers/index.js";

export default function App() {
  const [settings, setSettings] = useSettings();
  const [tab, setTab] = useState("generate");

  return (
    <div className="app">
      <header className="topbar">
        <h1>Random AI Prompt</h1>
        <nav>
          <button className={tab === "generate" ? "active" : ""} onClick={() => setTab("generate")}>
            Generate
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            Settings
          </button>
        </nav>
        <span className="mode">{ONLINE ? "online" : "local"}</span>
      </header>

      <main>
        {tab === "generate" ? (
          <Generate settings={settings} setSettings={setSettings} />
        ) : (
          <Settings settings={settings} setSettings={setSettings} />
        )}
      </main>

      <footer>
        Stored only in this browser. Bring your own API key. Nothing is saved on a server.
      </footer>
    </div>
  );
}

function Generate({ settings, setSettings }) {
  const [prompts, setPrompts] = useState([]);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const provider = getProvider(settings.provider);

  function onGeneratePrompts() {
    setError("");
    setImages([]);
    setPrompts(generatePrompts(settings));
  }

  async function onGenerateImages() {
    setError("");
    setBusy(true);
    setImages([]);
    try {
      const list = prompts.length ? prompts : generatePrompts(settings);
      setPrompts(list);
      const key = settings.keys?.[provider.id] || "";
      if (provider.needsKey && !key) {
        throw new Error(`This provider needs an API key — add one in Settings.`);
      }
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
    <section className="panel">
      <label>
        Prompt
        <textarea
          rows={3}
          value={settings.prompt}
          onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
          placeholder="#random"
        />
      </label>

      <div className="row">
        <label>
          Count
          <input
            type="number"
            min={1}
            max={50}
            value={settings.promptCount}
            onChange={(e) => setSettings({ ...settings, promptCount: Number(e.target.value) })}
          />
        </label>
        <div className="grow" />
        <button onClick={onGeneratePrompts}>Generate prompt</button>
        <button onClick={onGenerateImages} disabled={busy}>
          {busy ? "Generating…" : "Generate image"}
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

      {images.length > 0 && (
        <div className="gallery">
          {images.map((src, i) => (
            <img key={i} src={src} alt={`result ${i + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function Settings({ settings, setSettings }) {
  const providers = availableProviders();
  const provider = getProvider(settings.provider);

  function set(patch) {
    setSettings({ ...settings, ...patch });
  }
  function setKey(id, value) {
    setSettings({ ...settings, keys: { ...settings.keys, [id]: value } });
  }

  return (
    <section className="panel">
      <label>
        Provider
        <select value={settings.provider} onChange={(e) => set({ provider: e.target.value })}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {provider.local && (
        <label>
          Local WebUI URL
          <input
            type="text"
            value={settings.localWebuiUrl}
            onChange={(e) => set({ localWebuiUrl: e.target.value })}
          />
        </label>
      )}

      {provider.needsKey && (
        <label>
          API key for {provider.label}
          <input
            type="password"
            value={settings.keys?.[provider.id] || ""}
            onChange={(e) => setKey(provider.id, e.target.value)}
            placeholder="kept only in this browser"
            autoComplete="off"
          />
        </label>
      )}

      <div className="row">
        <label>
          Width
          <input
            type="number"
            value={settings.imageWidth}
            onChange={(e) => set({ imageWidth: Number(e.target.value) })}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            value={settings.imageHeight}
            onChange={(e) => set({ imageHeight: Number(e.target.value) })}
          />
        </label>
        <label>
          Steps
          <input
            type="number"
            value={settings.imageSteps}
            onChange={(e) => set({ imageSteps: Number(e.target.value) })}
          />
        </label>
        <label>
          CFG
          <input
            type="number"
            step="0.5"
            value={settings.cfg}
            onChange={(e) => set({ cfg: Number(e.target.value) })}
          />
        </label>
      </div>

      <label>
        Negative prompt
        <textarea
          rows={2}
          value={settings.negativePrompt}
          onChange={(e) => set({ negativePrompt: e.target.value })}
        />
      </label>
    </section>
  );
}
