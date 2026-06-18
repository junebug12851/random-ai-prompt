import { useEffect, useState } from "react";
import { useSettings } from "./lib/settings.js";
import { ONLINE } from "./lib/providers/index.js";
import { readSharedSettings } from "./lib/share.js";
import Generate from "./components/Generate.jsx";
import Builder from "./components/Builder.jsx";
import Settings from "./components/Settings.jsx";

const TABS = [
  { id: "generate", label: "Generate", Component: Generate },
  { id: "build", label: "Build", Component: Builder },
  { id: "settings", label: "Settings", Component: Settings },
];

export default function App() {
  const [settings, setSettings] = useSettings();
  const [tab, setTab] = useState("generate");
  const Active = TABS.find((t) => t.id === tab).Component;

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
        <h1>Random AI Prompt</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <span className="mode" title={ONLINE ? "deployed build" : "local build"}>
          {ONLINE ? "online" : "local"}
        </span>
      </header>

      <main>
        <Active settings={settings} setSettings={setSettings} />
      </main>

      <footer>Stored only in this browser · bring your own API key · nothing saved on a server</footer>
    </div>
  );
}
