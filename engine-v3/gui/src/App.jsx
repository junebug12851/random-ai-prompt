/**
 * The SPA shell: a slim brand top-bar (logo + wordmark) over the two-pane Home
 * workspace and a privacy footer. A shared link (`#s=…`) seeds settings on load.
 *
 * Temporarily removed (see notes/plans/removed-pending-readd.md): the centered
 * hero, the local/online mode badge, and the Settings button + drawer.
 * @module gui/App
 */
import { useEffect, useState } from "react";
import { useSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import Home from "./components/Home.jsx";
import NsfwToggle from "./components/NsfwToggle.jsx";
import SettingsDrawer from "./components/SettingsDrawer.jsx";
import ProviderSelect from "./components/ProviderSelect.jsx";

const GearIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * The application shell component.
 * @returns {JSX.Element} The app (top bar + Home + footer).
 */
export default function App() {
  const [settings, setSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <button
          className="settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="Prompt settings"
          aria-label="Open prompt settings"
        >
          <GearIcon />
        </button>
      </header>

      <main>
        <Home settings={settings} setSettings={setSettings} />
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
      />

      <footer>
        Stored only in this browser · bring your own API key · nothing saved on a server
      </footer>
    </div>
  );
}
