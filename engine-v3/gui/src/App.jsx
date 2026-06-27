/**
 * The SPA shell: a slim brand top-bar (logo + wordmark + a Generate / Gallery / Single view switch
 * + provider picker + NSFW toggle) over the three top-level views and a privacy footer.
 *
 * All three views (Home, Gallery, SingleView) stay **mounted** the whole session and are shown one
 * at a time via a CSS class — so each keeps its full state (and scroll position) when you switch
 * tabs, with no manual save/restore. The shared bits they coordinate on — the saved-image feed, the
 * gallery search query, and the image open in the single view — live here in `App`. Clicking a
 * generated image (in Home) or a gallery thumbnail opens it in the single view; Back returns to
 * wherever you came from, intact. A shared link (`#s=…`) seeds settings on load.
 *
 * The online build (`VITE_ONLINE`) is a stripped variant: Generate only — no Gallery/Single tabbar
 * (there's no local image feed and nothing is stored to the browser) and NSFW forced off with no toggle.
 * @module gui/App
 */
import { useEffect, useState } from "react";
import { useSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import { fetchGallery } from "./lib/gallery.js";
import { fetchMagick } from "./lib/magick.js";
import { deleteImageFile } from "./lib/output.js";
import Home from "./components/Home.jsx";
import Gallery from "./components/Gallery.jsx";
import SingleView from "./components/SingleView.jsx";
import NsfwToggle from "./components/NsfwToggle.jsx";
import ProviderSelect from "./components/ProviderSelect.jsx";

const TABS = [
  ["generate", "Generate"],
  ["gallery", "Gallery"],
  ["single", "Single"],
];

// The online (deployed, no-local-server) build is a stripped variant: Generate only — no
// Gallery/Single tabbar (the image feed needs the dev server's filesystem and nothing is stored to
// the browser), and NSFW is forced off with no toggle at all.
const ONLINE = import.meta.env.VITE_ONLINE === "true";

/**
 * The application shell component.
 * @returns {JSX.Element} The app (top bar + the three views + footer).
 */
export default function App() {
  const [settings, setSettings] = useSettings();
  const [view, setView] = useState("generate"); // "generate" | "gallery" | "single"
  const [items, setItems] = useState([]); // the saved-image feed (newest first)
  const [loadingItems, setLoadingItems] = useState(true);
  const [query, setQuery] = useState(""); // gallery search (lifted so it persists + chips can set it)
  const [current, setCurrent] = useState(null); // the image open in the single view
  const [returnTo, setReturnTo] = useState("generate"); // where the single view's Back goes
  const [magick, setMagick] = useState({ available: false, formats: [] });

  // A shared link (#s=...) seeds settings on load, then the hash is cleared.
  useEffect(() => {
    const shared = readSharedSettings();
    if (shared) {
      setSettings((s) => ({ ...s, ...shared }));
      history.replaceState(null, "", location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the feed + ImageMagick capability once for the session. The online build has no gallery
  // and no NSFW option, so it skips the feed and forces adult content off.
  useEffect(() => {
    if (ONLINE) {
      setLoadingItems(false);
      if (settings.includeAdult) setSettings((s) => ({ ...s, includeAdult: false }));
    } else {
      loadFeed();
    }
    fetchMagick().then(setMagick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFeed() {
    setLoadingItems(true);
    const it = await fetchGallery();
    setItems(it);
    setLoadingItems(false);
    return it;
  }

  // Switch view via a header tab. Going to the single view the first time (no image loaded yet)
  // lands on a random one; otherwise it keeps the last image shown.
  function go(next) {
    if (next === "single") {
      if (view !== "single") setReturnTo(view);
      if (!current && items.length) setCurrent(items[Math.floor(Math.random() * items.length)]);
    }
    setView(next);
  }

  // Open a gallery thumbnail in the single view (Back returns to the gallery).
  function openFromGallery(item) {
    setCurrent(item);
    setReturnTo("gallery");
    setView("single");
  }

  // Open a freshly generated image (by its served path) in the single view (Back returns to
  // Generate). Resolve the path to a feed item — refreshing the feed if it's not loaded yet.
  async function openGeneratedImage(path) {
    let found = items.find((i) => i.path === path);
    if (!found) found = (await loadFeed()).find((i) => i.path === path);
    const name = (path.split("/").pop() || "").replace(/\.[^.]+$/, "");
    setCurrent(found || { path, file: path.split("/").pop(), name, meta: null });
    setReturnTo("generate");
    setView("single");
  }

  // Search the gallery for a keyword (from a single-view keyword chip).
  function searchFor(term) {
    setQuery(term);
    setView("gallery");
  }

  // Apply an updated metadata sidecar (e.g. an edited keyword list) to the feed + the open image,
  // so the single view reflects the save without a full feed reload.
  function updateItemMeta(path, meta) {
    if (!meta) return;
    setItems((list) => list.map((x) => (x.path === path ? { ...x, meta } : x)));
    setCurrent((cur) => (cur && cur.path === path ? { ...cur, meta } : cur));
  }

  // Delete an image (+ sidecar) from disk; in the single view, land on a neighbor (or leave).
  async function deleteItem(item) {
    if (!confirm("Delete this image and its metadata from disk? This can't be undone.")) return;
    await deleteImageFile(item.path);
    const i = items.findIndex((x) => x.path === item.path);
    const neighbor = items[i + 1] || items[i - 1] || null;
    setItems((list) => list.filter((x) => x.path !== item.path));
    setCurrent((cur) => (cur && cur.path === item.path ? neighbor : cur));
    if (!neighbor && view === "single") setView(returnTo);
  }

  const returnLabel = returnTo === "generate" ? "Generate" : "Gallery";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <span className="wordmark">Random AI Prompt</span>
        </div>
        {!ONLINE && (
          <div className="view-switch" role="tablist" aria-label="Switch view">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                className={`vs-tab${view === id ? " on" : ""}`}
                onClick={() => go(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="topbar-spacer" />
        {view === "generate" && <ProviderSelect settings={settings} setSettings={setSettings} />}
        {!ONLINE && <NsfwToggle settings={settings} setSettings={setSettings} />}
      </header>

      <main>
        <div className={`view-pane${view === "generate" ? " on" : ""}`}>
          <Home
            settings={settings}
            setSettings={setSettings}
            onOpenImage={ONLINE ? undefined : openGeneratedImage}
          />
        </div>
        {/* Gallery + Single are local-only: the online build has no image feed and omits them. */}
        {!ONLINE && (
          <>
            <div className={`view-pane${view === "gallery" ? " on" : ""}`}>
              <Gallery
                items={items}
                loading={loadingItems}
                query={query}
                onQueryChange={setQuery}
                onOpen={openFromGallery}
                onRefresh={loadFeed}
                onDelete={deleteItem}
              />
            </div>
            <div className={`view-pane${view === "single" ? " on" : ""}`}>
              <SingleView
                items={items}
                current={current}
                magick={magick}
                settings={settings}
                active={view === "single"}
                returnLabel={returnLabel}
                onBack={() => setView(returnTo)}
                onNavigate={setCurrent}
                onDelete={deleteItem}
                onSearch={searchFor}
                onMetaUpdate={updateItemMeta}
              />
            </div>
          </>
        )}
      </main>

      <footer>
        Stored only in this browser · bring your own API key · nothing saved on a server
      </footer>
    </div>
  );
}
