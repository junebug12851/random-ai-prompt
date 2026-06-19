/**
 * The SPA shell: a compact brand top-bar (logo + wordmark, local/online badge, Settings
 * button), a centered hero, the unified Home composer, a slide-over Settings drawer, and
 * a privacy footer. A shared link (`#s=…`) seeds settings on load.
 * @module web-app/App
 */
import { useEffect, useState } from "react";
import { useSettings } from "./lib/settings.js";
import { ONLINE } from "./lib/providers/index.js";
import { readSharedSettings } from "./lib/share.js";
import Home from "./components/Home.jsx";
import SettingsDrawer from "./components/SettingsDrawer.jsx";

/**
 * The application shell component.
 * @returns {JSX.Element} The app (top bar + hero + Home + settings drawer + footer).
 */
export default function App() {
  const [settings, setSettings] = useSettings();
  const [drawer, setDrawer] = useState(false);

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
        <div className="spacer" />
        <span className={`mode${ONLINE ? " is-online" : ""}`} title={ONLINE ? "deployed build" : "local build"}>
          {ONLINE ? "online" : "local"}
        </span>
        <button className="ghost icon-btn" onClick={() => setDrawer(true)} title="Open all generation settings">
          ⚙ Settings
        </button>
      </header>

      <div className="hero">
        <img className="logo" src="/logo.png" alt="Random AI Prompt" />
        <h1>Random AI Prompt</h1>
        <p className="subtitle">The random generator — compose a prompt, roll the dice, make art.</p>
      </div>

      <main>
        <Home settings={settings} setSettings={setSettings} />
      </main>

      <SettingsDrawer open={drawer} onClose={() => setDrawer(false)} settings={settings} setSettings={setSettings} />

      <footer>Stored only in this browser · bring your own API key · nothing saved on a server</footer>
    </div>
  );
}
