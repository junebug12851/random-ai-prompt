/**
 * The SPA shell: a slim brand top-bar (logo + wordmark + provider picker + NSFW toggle) over
 * the two-pane Home workspace and a privacy footer. A shared link (`#s=…`) seeds settings on
 * load. The prompt-settings gear lives on the prompt box (in Home), not here.
 * @module gui/App
 */
import { useEffect } from "react";
import { useSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import Home from "./components/Home.jsx";
import NsfwToggle from "./components/NsfwToggle.jsx";
import ProviderSelect from "./components/ProviderSelect.jsx";

/**
 * The application shell component.
 * @returns {JSX.Element} The app (top bar + Home + footer).
 */
export default function App() {
  const [settings, setSettings] = useSettings();

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
        <div className="topbar-spacer" />
        <ProviderSelect settings={settings} setSettings={setSettings} />
        <NsfwToggle settings={settings} setSettings={setSettings} />
      </header>

      <main>
        <Home settings={settings} setSettings={setSettings} />
      </main>

      <footer>
        Stored only in this browser · bring your own API key · nothing saved on a server
      </footer>
    </div>
  );
}
