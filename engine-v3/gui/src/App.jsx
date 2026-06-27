/**
 * The SPA shell: a slim brand top-bar (logo + wordmark + a Generate/Gallery view switch + provider
 * picker + NSFW toggle) over the active view — the two-pane Home workspace or the photo gallery —
 * and a privacy footer. A shared link (`#s=…`) seeds settings on load. The prompt-settings gear
 * lives on the prompt box (in Home), not here.
 * @module gui/App
 */
import { useEffect, useState } from "react";
import { useSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import Home from "./components/Home.jsx";
import Gallery from "./components/Gallery.jsx";
import NsfwToggle from "./components/NsfwToggle.jsx";
import ProviderSelect from "./components/ProviderSelect.jsx";

/**
 * The application shell component.
 * @returns {JSX.Element} The app (top bar + Home + footer).
 */
export default function App() {
  const [settings, setSettings] = useSettings();
  const [view, setView] = useState("generate"); // "generate" | "gallery"

  // A shared link (#s=...) seeds settings on load, then the hash is cleared.
  useEffect(() => {
    const shared = readSharedSettings();
    if (shared) {
      setSettings((s) => ({ ...s, ...shared }));
      history.replaceState(null, "", location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <span className="wordmark">Random AI Prompt</span>
        </div>
        <div
          className="view-switch"
          role="tablist"
          aria-label="Switch between image generation and the photo gallery"
        >
          <button
            role="tab"
            aria-selected={view === "generate"}
            className={`vs-tab${view === "generate" ? " on" : ""}`}
            onClick={() => setView("generate")}
          >
            Generate
          </button>
          <button
            role="tab"
            aria-selected={view === "gallery"}
            className={`vs-tab${view === "gallery" ? " on" : ""}`}
            onClick={() => setView("gallery")}
          >
            Gallery
          </button>
        </div>
        <div className="topbar-spacer" />
        {view === "generate" && <ProviderSelect settings={settings} setSettings={setSettings} />}
        <NsfwToggle settings={settings} setSettings={setSettings} />
      </header>

      <main>
        {view === "generate" ? (
          <Home settings={settings} setSettings={setSettings} />
        ) : (
          <Gallery />
        )}
      </main>

      <footer>
        Stored only in this browser · bring your own API key · nothing saved on a server
      </footer>
    </div>
  );
}
