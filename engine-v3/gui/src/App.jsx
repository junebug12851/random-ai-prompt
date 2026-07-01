/**
 * The SPA shell: a slim brand top-bar (logo + wordmark + a Generate / Gallery / Single view switch
 * + a Providers dropdown (image + text providers, each with its BYOK key) + a provider-settings
 * gear + NSFW toggle) over the three top-level views and a privacy footer.
 *
 * All three views (Home, Gallery, SingleView) stay **mounted** the whole session and are shown one
 * at a time via a CSS class — so each keeps its full state (and scroll position) when you switch
 * tabs, with no manual save/restore. The shared bits they coordinate on — the saved-image feed, the
 * gallery search query, and the image open in the single view — live here in `App`. Clicking a
 * generated image (in Home) or a gallery thumbnail opens it in the single view; Back returns to
 * wherever you came from, intact. A shared link (`#s=…`) seeds settings on load.
 *
 * The online build (`VITE_ONLINE`) is a stripped variant: Generate works, but the Gallery/Single
 * tabs, the local image providers, and the NSFW toggle are shown **disabled** (greyed, with a
 * tooltip + a link to the full desktop version) because they need a local machine; NSFW is also
 * forced off. See `lib/online.js`.
 * @module gui/App
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { I18nProvider } from "./i18n/index.js";
import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import { useUserThemes } from "./theme/userThemeStore.js";
import { hydrate, isHydrated, rehydrate, msSinceLastWrite } from "../storage/cache.js";
import { useSettings, loadSettings } from "./lib/settings.js";
import { readSharedSettings } from "./lib/share.js";
import { fetchGallery, linkAncestry } from "./lib/gallery.js";
import { fetchMagick } from "./lib/magick.js";
import { deleteImageFile, ingestImage } from "./lib/output.js";
import { deriveImage as runDerive, resizeImage as runResize } from "./lib/derive.js";
import { softLockedForNsfw } from "./lib/contentPolicy.js";
import { effectiveKey } from "./lib/sessionKeys.js";
import { ONLINE, lockedHint, openFullVersion } from "./lib/online.js";
import { getProvider, availableProviders } from "./lib/providers/index.js";
import { providerMode } from "./lib/useProvider.js";
import { refreshCatalog, ensureCatalog } from "./lib/promptEngine.js";
import { managerAvailable } from "./lib/manageApi.js";
import { dialog } from "./lib/dialog.js";
import NsfwToggle from "./components/NsfwToggle.jsx";
import ProvidersMenu from "./components/ProvidersMenu.jsx";
import ProviderGear from "./components/ProviderGear.jsx";
import LinksMenu from "./components/LinksMenu.jsx";
import ThemePicker from "./components/ThemePicker.jsx";
import DialogHost from "./components/DialogHost.jsx";

// Home is lazy-loaded too: its subtree (the block palette, the DPL editor, live preview, the
// per-prompt result cards) is a big slice of the app UI, so splitting it out of the entry chunk lets
// the top bar / shell paint first (better FCP) while the Generate view streams in right behind it.
const Home = lazy(() => import("./components/Home.jsx"));
// The local-only views are lazy-loaded so their code (and, for Manage, all of CodeMirror)
// is split into separate chunks the browser fetches only when the view is first opened —
// keeping the initial Generate-screen payload small. Once opened, a pane stays mounted (so
// its state/scroll persist), exactly as before; lazy only defers the FIRST mount.
const Gallery = lazy(() => import("./components/Gallery.jsx"));
const SingleView = lazy(() => import("./components/SingleView.jsx"));
const Manage = lazy(() => import("./components/Manage.jsx"));

// [id, labelKey, featureKey, descKey]. Gallery/Single are local-only — online shows them disabled.
// Manage needs the local-mode file backend (a runtime capability, not the build stage).
// labelKey/featureKey/descKey index into `msgs` below so the strings are localized at render.
const TABS = [
  ["generate", "tabGenerate", null, "tabGenerateDesc"],
  ["gallery", "tabGallery", "featureGallery", "tabGalleryDesc"],
  ["single", "tabSingle", "featureSingle", "tabSingleDesc"],
  ["manage", "tabManage", null, "tabManageDesc"],
];

const msgs = defineMessages({
  switchView: {
    id: "app.switchView",
    defaultMessage: "Switch view",
    description: "aria-label for the top-bar view switcher",
  },
  tabGenerate: { id: "app.tab.generate", defaultMessage: "Generate" },
  tabGallery: { id: "app.tab.gallery", defaultMessage: "Gallery" },
  tabSingle: { id: "app.tab.single", defaultMessage: "Single" },
  tabManage: { id: "app.tab.manage", defaultMessage: "Manage" },
  tabGenerateDesc: {
    id: "app.tab.generate.desc",
    defaultMessage: "Compose prompts and generate images",
  },
  tabGalleryDesc: { id: "app.tab.gallery.desc", defaultMessage: "Browse your saved images" },
  tabSingleDesc: {
    id: "app.tab.single.desc",
    defaultMessage: "View one image up close — details, re-rolls, and resizes",
  },
  tabManageDesc: {
    id: "app.tab.manage.desc",
    defaultMessage: "Edit the building blocks and word lists on disk",
  },
  featureGallery: {
    id: "app.feature.gallery",
    defaultMessage: "The gallery",
    description: "Noun phrase for the gallery, used in the online-locked tooltip",
  },
  featureSingle: {
    id: "app.feature.single",
    defaultMessage: "The single-image view",
    description: "Noun phrase for the single view, used in the online-locked tooltip",
  },
  manageLocked: {
    id: "app.manageLocked",
    defaultMessage: "Manage needs the local app (file access) — unavailable online",
    description: "Tooltip when the Manage tab is unavailable (no local backend)",
  },
  deleteConfirm: {
    id: "app.deleteConfirm",
    defaultMessage: "Delete this image and its metadata from disk? This can't be undone.",
    description: "Confirm dialog before deleting an image from disk",
  },
  deleteAction: {
    id: "app.deleteAction",
    defaultMessage: "Delete",
    description: "Accept-button label on the delete-image confirm dialog",
  },
  nsfwProceed: {
    id: "app.nsfwProceed",
    defaultMessage: "NSFW mode is on. Continue with {provider} anyway?",
    description: "Soft confirm before using a safe-for-work-only provider while NSFW mode is on",
  },
  footer: {
    id: "app.footer",
    defaultMessage:
      "Stored only in this browser · bring your own API key · nothing saved on a server",
    description: "Privacy footer line",
  },
});

/**
 * The application root: owns settings and establishes the i18n boundary so the
 * whole shell (and its localized strings) renders under a configured provider.
 * @returns {JSX.Element}
 */
export default function App() {
  // Gate the first render on the storage cache hydrating (loads settings/presets/wrappers/provider
  // overrides from the backend, migrating any legacy localStorage). The stores read synchronously
  // from the cache afterward, so nothing below here has to be storage-aware. Hydration is fast
  // (localStorage online; one fetch locally) — a blank frame, like the lazy panes' Suspense fallback.
  const [ready, setReady] = useState(isHydrated());
  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    hydrate().finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  if (!ready) return null;
  return <HydratedApp />;
}

/**
 * The app once the storage cache is hydrated: owns settings and establishes the i18n boundary.
 * @returns {JSX.Element}
 */
function HydratedApp() {
  const [settings, setSettings] = useSettings();
  const [userThemes, addUserTheme, removeUserTheme] = useUserThemes();
  return (
    <I18nProvider locale={settings.locale}>
      <ThemeProvider
        mode={settings.themeMode}
        setMode={(m) => setSettings((s) => ({ ...s, themeMode: m }))}
        accent={settings.accent}
        setAccent={(a) => setSettings((s) => ({ ...s, accent: a }))}
        userThemes={userThemes}
        addUserTheme={addUserTheme}
        removeUserTheme={removeUserTheme}
      >
        <AppShell settings={settings} setSettings={setSettings} />
        <DialogHost />
      </ThemeProvider>
    </I18nProvider>
  );
}

/**
 * The application shell component (top bar + the views + footer).
 * @param {object} props
 * @param {object} props.settings The current settings.
 * @param {Function} props.setSettings Update the settings.
 * @returns {JSX.Element}
 */
function AppShell({ settings, setSettings }) {
  const intl = useIntl();
  const [view, setView] = useState("generate"); // "generate" | "gallery" | "single"
  // Views the user has opened at least once. A lazy pane is only rendered after its first
  // open, then kept mounted — so we never fetch the Gallery/Single/Manage chunks (CodeMirror
  // included) until they're actually needed, without losing per-view state on tab switches.
  const [opened, setOpened] = useState(() => new Set(["generate"]));
  const [items, setItems] = useState([]); // the saved-image feed (newest first)
  const [loadingItems, setLoadingItems] = useState(true);
  const [query, setQuery] = useState(""); // gallery search (lifted so it persists + chips can set it)
  const [current, setCurrent] = useState(null); // the image open in the single view
  const [returnTo, setReturnTo] = useState("generate"); // where the single view's Back goes
  const [deriveError, setDeriveError] = useState(""); // last re-roll / variation / resize failure
  const [derivations, setDerivations] = useState([]); // in-flight ops: { id, parentPath, kind }
  const [magick, setMagick] = useState({ available: false, formats: [] });
  const [managerOk, setManagerOk] = useState(false); // local-mode content backend present?

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
      // A saved provider that can't run online (a local-direct or hosted-proxy one) — fall back to
      // the first browser-direct image provider so generation works out of the box.
      const cur = getProvider(settings.provider);
      const usableOnline = cur && !cur.local && cur.transport !== "hosted-proxy";
      if (!usableOnline) {
        const avail = availableProviders();
        const fallback = avail.find((p) => p.loadGenerate) || avail[0];
        if (fallback) {
          setSettings((s) => ({ ...s, provider: fallback.id, mode: providerMode(fallback.id) }));
        }
      }
    } else {
      loadFeed();
    }
    fetchMagick().then(setMagick);
    // Load the bundled prompt corpus — code-split off the initial module graph. The palette already
    // renders from the (free) name catalog, so defer the heavy content fetch to idle time: that keeps
    // it from competing with the preloaded fonts + first paint for bandwidth (better LCP), and the
    // palette/generation fill in once it resolves (via the catalog-change notification). See
    // promptEngine.ensureCatalog.
    const idle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (fn) => setTimeout(fn, 200);
    idle(() => ensureCatalog());
    // Switch the engine from the build-time bundle to the live disk snapshot (local mode only).
    // A no-op online / on a static host — Generate keeps using the bundled catalog.
    refreshCatalog().catch(() => {});
    // Probe for the content-management backend; its presence unlocks the Manage tab.
    managerAvailable().then(setManagerOk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember each view the moment it's first shown, so its lazy pane mounts and then persists.
  useEffect(() => {
    setOpened((o) => (o.has(view) ? o : new Set(o).add(view)));
  }, [view]);

  // Local mode: one SSE stream makes the app aware of changes to its own files and hot-reloads.
  //   • data     → re-read the live catalog (lists / dynamic-prompts) so Generate + Manage reflect
  //                external edits (Manage's tree refreshes via its subscribeCatalog).
  //   • output   → reload the gallery feed so images added / removed / changed on disk appear.
  //   • settings → re-read settings from disk so an external edit applies — but skip events caused
  //                by our OWN writes (msSinceLastWrite) and only swap when the value actually
  //                changed, so we never fight or clobber the app's own saves (never-corrupt rule).
  // A no-op online (no backend) or until the local content backend is detected.
  useEffect(() => {
    if (ONLINE || !managerOk) return undefined;
    let es;
    const timers = {};
    const debounce = (key, fn, ms = 250) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(fn, ms);
    };
    try {
      es = new EventSource("/api/manage/watch");
      es.addEventListener("data", () =>
        debounce("data", () => refreshCatalog().catch(() => {})),
      );
      es.addEventListener("output", () => debounce("output", () => loadFeed()));
      es.addEventListener("settings", () =>
        debounce("settings", async () => {
          if (msSinceLastWrite() < 1500) return; // our own save — ignore
          await rehydrate();
          const fresh = loadSettings();
          setSettings((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
        }),
      );
    } catch {
      /* no SSE here — the manual refresh paths still work */
    }
    return () => {
      if (es) es.close();
      for (const t of Object.values(timers)) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerOk]);

  async function loadFeed() {
    setLoadingItems(true);
    const it = linkAncestry(await fetchGallery());
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

  // After a derive/resize lands, refresh the feed (rebuilds ancestry) and re-sync the open image to
  // its fresh copy so its children strips update in place — without leaving the current image.
  async function refreshAndResync(parentPath) {
    const fresh = await loadFeed();
    setCurrent((cur) => (cur ? fresh.find((i) => i.path === cur.path) || cur : cur));
    return fresh;
  }

  // Re-roll / vary the open image: generate a NEW image from a chosen prompt layer. We deliberately
  // DON'T navigate away — a live placeholder appears in the matching strip below the image (via the
  // `derivations` list), and the finished child slots into that strip once the feed refreshes.
  // Soft NSFW gate: if the provider about to be called is safe-for-work-only and NSFW mode is on,
  // ask once before proceeding. Returns false only when the user declines. Never hard-blocks.
  async function nsfwOkFor(provider) {
    if (!softLockedForNsfw(provider, settings.includeAdult)) return true;
    return dialog.confirm({
      message: intl.formatMessage(msgs.nsfwProceed, { provider: provider?.label }),
    });
  }

  async function deriveImage(item, kind, source) {
    setDeriveError("");
    if (!(await nsfwOkFor(getProvider(item.meta?.provider)))) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDerivations((d) => [...d, { id, parentPath: item.path, kind }]);
    try {
      await runDerive({ item, kind, source, settings });
      await refreshAndResync(item.path);
    } catch (e) {
      setDeriveError(e.message || String(e));
    } finally {
      setDerivations((d) => d.filter((x) => x.id !== id));
    }
  }

  // AI upscale: run a provider's upscale adapter on the open image and save the result as a tracked
  // child (Resizes strip), same live-placeholder flow as a derive. Dormant until a provider ships a
  // `loadUpscale` adapter + `capabilities.upscale`; the single view only offers providers that have.
  async function upscaleImage(item, providerId) {
    setDeriveError("");
    const prov = getProvider(providerId);
    if (!prov?.loadUpscale) return;
    if (!(await nsfwOkFor(prov))) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDerivations((d) => [...d, { id, parentPath: item.path, kind: "resize" }]);
    try {
      const upscale = await prov.loadUpscale();
      const key = effectiveKey(prov.id, settings);
      const src = item.path.startsWith("/") ? new URL(item.path, location.origin).href : item.path;
      // Pass the LIVE app settings merged with this upscaler's own params (e.g. a local WebUI's URL),
      // not the source image's frozen generation snapshot.
      const upSettings = { ...settings, ...(settings.providerParams?.[prov.id] || {}) };
      const { images } = await upscale({ image: src, key, settings: upSettings });
      if (!images || !images.length) throw new Error("The upscaler returned no image.");
      const childMeta = {
        prompt: item.meta?.prompt || null,
        negative: item.meta?.negative || null,
        provider: item.meta?.provider,
        providerLabel: item.meta?.providerLabel,
        settings: { ...(item.meta?.settings || {}), aiUpscaleBy: prov.id },
        parent: item.name,
        derivedKind: "resize",
        aiUpscaleBy: prov.id,
        savedAt: new Date().toISOString(),
      };
      await ingestImage(images[0], childMeta);
      await refreshAndResync(item.path);
    } catch (e) {
      setDeriveError(e.message || String(e));
    } finally {
      setDerivations((d) => d.filter((x) => x.id !== id));
    }
  }

  // Resize (downscale / upscale via ImageMagick) the open image into a new tracked child — same
  // in-place, live-placeholder flow as a derive, landing in the Resizes strip.
  async function resizeImage(item, scale) {
    setDeriveError("");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDerivations((d) => [...d, { id, parentPath: item.path, kind: "resize" }]);
    try {
      await runResize({ item, scale });
      await refreshAndResync(item.path);
    } catch (e) {
      setDeriveError(e.message || String(e));
    } finally {
      setDerivations((d) => d.filter((x) => x.id !== id));
    }
  }

  // Delete an image (+ sidecar) from disk; in the single view, land on a neighbor (or leave).
  async function deleteItem(item) {
    if (
      !(await dialog.confirm({
        message: intl.formatMessage(msgs.deleteConfirm),
        confirmLabel: intl.formatMessage(msgs.deleteAction),
        destructive: true,
      }))
    )
      return;
    await deleteImageFile(item.path);
    const i = items.findIndex((x) => x.path === item.path);
    const neighbor = items[i + 1] || items[i - 1] || null;
    setItems((list) => list.filter((x) => x.path !== item.path));
    setCurrent((cur) => (cur && cur.path === item.path ? neighbor : cur));
    if (!neighbor && view === "single") setView(returnTo);
  }

  const returnLabel = intl.formatMessage(returnTo === "generate" ? msgs.tabGenerate : msgs.tabGallery);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title="Random AI Prompt">
          <img src="/logo.png" alt="" />
          <span className="wordmark">Random AI Prompt</span>
        </div>
        <div className="view-switch" role="tablist" aria-label={intl.formatMessage(msgs.switchView)}>
          {TABS.map(([id, labelKey, featureKey, descKey]) => {
            const label = intl.formatMessage(msgs[labelKey]);
            // Manage is gated on the local-mode backend (a runtime capability); Gallery/Single are
            // gated on the online build. Manage clicks while locked are inert (no full-version link).
            const locked = id === "manage" ? !managerOk : ONLINE && id !== "generate";
            const hint =
              id === "manage"
                ? intl.formatMessage(msgs.manageLocked)
                : lockedHint(intl, featureKey ? intl.formatMessage(msgs[featureKey]) : label);
            // Unlocked tabs get a plain descriptive tooltip; locked ones explain why.
            const tabTitle = locked ? hint : intl.formatMessage(msgs[descKey]);
            return (
              <button
                key={id}
                role="tab"
                aria-selected={!locked && view === id}
                aria-disabled={locked || undefined}
                className={`vs-tab${!locked && view === id ? " on" : ""}${locked ? " is-locked" : ""}`}
                title={tabTitle}
                onClick={() => (locked ? (id !== "manage" ? openFullVersion() : undefined) : go(id))}
              >
                {label}
                {locked && (
                  <span className="lock-badge" aria-hidden="true">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="topbar-spacer" />
        {/* Header controls live on every tab now (not just Generate). */}
        <ProvidersMenu settings={settings} setSettings={setSettings} />
        <ProviderGear settings={settings} setSettings={setSettings} />
        <NsfwToggle settings={settings} setSettings={setSettings} locked={ONLINE} />
        <ThemePicker />
        <LinksMenu settings={settings} setSettings={setSettings} />
      </header>

      <main>
        <div className={`view-pane${view === "generate" ? " on" : ""}`}>
          <Suspense fallback={null}>
            <Home
              settings={settings}
              setSettings={setSettings}
              onOpenImage={ONLINE ? undefined : openGeneratedImage}
            />
          </Suspense>
        </div>
        {/* Gallery + Single are local-only: the online build has no image feed and omits them.
            Each mounts (and fetches its chunk) only once first opened, then stays mounted. */}
        {!ONLINE && opened.has("gallery") && (
          <div className={`view-pane${view === "gallery" ? " on" : ""}`}>
            <Suspense fallback={null}>
              <Gallery
                items={items}
                loading={loadingItems}
                query={query}
                onQueryChange={setQuery}
                onOpen={openFromGallery}
                onRefresh={loadFeed}
                onDelete={deleteItem}
              />
            </Suspense>
          </div>
        )}
        {!ONLINE && opened.has("single") && (
          <div className={`view-pane${view === "single" ? " on" : ""}`}>
            <Suspense fallback={null}>
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
                onDerive={deriveImage}
                onResize={resizeImage}
                onUpscale={upscaleImage}
                derivations={derivations}
                deriveError={deriveError}
              />
            </Suspense>
          </div>
        )}
        {/* Manage is local-only: only mounted when the file backend is present AND opened once
            (so the heavy CodeMirror editor chunk loads on demand, not on first paint). */}
        {managerOk && opened.has("manage") && (
          <div className={`view-pane${view === "manage" ? " on" : ""}`}>
            <Suspense fallback={null}>
              <Manage settings={settings} available={managerOk} active={view === "manage"} />
            </Suspense>
          </div>
        )}
      </main>

      <footer>{intl.formatMessage(msgs.footer)}</footer>
    </div>
  );
}
