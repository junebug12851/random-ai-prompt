/**
 * The SPA shell: a slim brand top-bar (logo + wordmark) over the two-pane Home
 * workspace and a privacy footer. A shared link (`#s=…`) seeds settings on load.
 *
 * Temporarily removed (see notes/plans/removed-pending-readd.md): the centered
 * hero, the local/online mode badge, and the Settings button + drawer.
 * @module web-app/App
 */
import { useEffect } from "react";
import { useSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import Home from "./components/Home.jsx";
import NsfwToggle from "./components/NsfwToggle.jsx";

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
        <NsfwToggle settings={settings} setSettings={setSettings} />
      </header>

      <main>
        <Home settings={settings} setSettings={setSettings} />
      </main>

      <footer>Stored only in this browser · bring your own API key · nothing saved on a server</footer>
    </div>
  );
}
