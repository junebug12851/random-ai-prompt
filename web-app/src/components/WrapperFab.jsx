/**
 * The "wrapper" control: a floating bottom-right button that frames every generated prompt
 * with a START and an END snippet (the v3 root layer = open + middle + close). Clicking it
 * opens a small popover listing saved wrapper presets (apply one, or "None"); a "Manage
 * presets" button there opens a modal with the two side-by-side Start/End editors plus
 * preset naming/management. The selected wrapper lives in `settings.wrapper` (so it is
 * shared by the share-link); the preset library lives in localStorage.
 * @module web-app/components/WrapperFab
 */
import { useEffect, useState } from "react";
import {
  getWrappers,
  saveWrapper,
  removeWrapper,
  renameWrapper,
  DEFAULT_WRAPPER,
} from "../lib/wrapperStore.js";

const ico = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
// Brackets — a "wraps around your prompt" glyph.
const WrapIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
  </svg>
);

/**
 * @param {object} props
 * @param {object} props.settings Current settings (reads `wrapper` / `wrapperName`).
 * @param {Function} props.setSettings Update settings.
 * @returns {JSX.Element}
 */
export default function WrapperFab({ settings, setSettings }) {
  const [view, setView] = useState(""); // "" | "list" | "manage"
  const [wrappers, setWrappers] = useState(() => getWrappers());
  const refresh = () => setWrappers(getWrappers());

  // Manage-modal editor state.
  const [sel, setSel] = useState(""); // the preset name being edited ("" = unsaved/new)
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // No explicit choice yet → the built-in Default is in effect. "None" means "no wrapper".
  const activeName = settings.wrapperName ?? "Default";
  const isActive = activeName !== "None";
  const names = Object.keys(wrappers).sort((a, b) => a.localeCompare(b));

  // Close on Escape.
  useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => e.key === "Escape" && setView(view === "manage" ? "list" : "");
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view]);

  function applyWrapper(n) {
    if (n === "None") {
      setSettings({ ...settings, wrapper: { start: "", end: "" }, wrapperName: "None" });
    } else if (n === "Default") {
      setSettings({ ...settings, wrapper: { ...DEFAULT_WRAPPER }, wrapperName: "Default" });
    } else {
      const w = wrappers[n] || { start: "", end: "" };
      setSettings({ ...settings, wrapper: { start: w.start, end: w.end }, wrapperName: n });
    }
    setView("");
  }

  function openManage(n = activeName) {
    refresh();
    const w = (n && getWrappers()[n]) || { start: "", end: "" };
    setSel(n && getWrappers()[n] ? n : "");
    setName(n || "");
    setStart(w.start || "");
    setEnd(w.end || "");
    setView("manage");
  }

  function editPreset(n) {
    const w = getWrappers()[n] || { start: "", end: "" };
    setSel(n);
    setName(n);
    setStart(w.start || "");
    setEnd(w.end || "");
  }

  function newPreset() {
    setSel("");
    setName("");
    setStart("");
    setEnd("");
  }

  function save() {
    const n = name.trim();
    if (!n) return;
    if (sel && sel !== n) renameWrapper(sel, n); // renamed an existing preset
    saveWrapper(n, { start, end });
    refresh();
    setSel(n);
    // If we were editing the active wrapper (or it now matches), keep it applied/in sync.
    if (!activeName || activeName === sel || activeName === n) {
      setSettings({ ...settings, wrapper: { start, end }, wrapperName: n });
    }
  }

  function del(n) {
    removeWrapper(n);
    refresh();
    if (sel === n) newPreset();
    // If the deleted preset was applied, fall back to the built-in Default.
    if (activeName === n) setSettings({ ...settings, wrapper: { ...DEFAULT_WRAPPER }, wrapperName: "Default" });
  }

  return (
    <>
      <button
        className={`field-act wrap-trigger${isActive ? " on" : ""}`}
        onClick={() => setView(view === "list" ? "" : "list")}
        title={`Wrapper: ${activeName} — frames every prompt with a start and end`}
        aria-label="Wrapper presets"
        aria-pressed={view === "list"}
      >
        <WrapIcon />
      </button>

      {view === "list" && (
        <>
          <div className="wrap-pop-scrim" onClick={() => setView("")} />
          <div className="wrap-pop" role="menu" aria-label="Wrapper presets">
            <div className="wrap-pop-head">
              <span>Wrapper</span>
              <button className="wrap-manage-btn" onClick={() => openManage()}>
                Manage presets
              </button>
            </div>
            <div className="wrap-pop-list">
              <button
                className={`wrap-pop-item${activeName === "Default" ? " on" : ""}`}
                onClick={() => applyWrapper("Default")}
              >
                <span className="wrap-pop-name">Default</span>
                {activeName === "Default" && <span className="wrap-check">✓</span>}
              </button>
              <button
                className={`wrap-pop-item${activeName === "None" ? " on" : ""}`}
                onClick={() => applyWrapper("None")}
              >
                <span className="wrap-pop-name">None</span>
                {activeName === "None" && <span className="wrap-check">✓</span>}
              </button>
              {names.length === 0 && <p className="wrap-empty">No saved wrappers — Manage presets to add one.</p>}
              {names.map((n) => (
                <button
                  key={n}
                  className={`wrap-pop-item${activeName === n ? " on" : ""}`}
                  onClick={() => applyWrapper(n)}
                >
                  <span className="wrap-pop-name">{n}</span>
                  {activeName === n && <span className="wrap-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === "manage" && (
        <>
          <div className="wrap-modal-overlay" onClick={() => setView("list")} />
          <div className="wrap-modal" role="dialog" aria-label="Manage wrappers">
            <div className="wrap-modal-head">
              <h2>Manage wrappers</h2>
              <div className="grow" />
              <button className="drawer-close" onClick={() => setView("list")} aria-label="Close">
                ×
              </button>
            </div>

            <div className="wrap-modal-body">
              {/* Preset management row */}
              <div className="wrap-presets">
                <div className="wrap-preset-pills">
                  {names.length === 0 && <span className="wrap-empty">No saved wrappers yet.</span>}
                  {names.map((n) => (
                    <span key={n} className={`wrap-preset-pill${sel === n ? " on" : ""}`}>
                      <button className="wrap-preset-pick" onClick={() => editPreset(n)} title={`Edit “${n}”`}>
                        {n}
                      </button>
                      <button className="wrap-preset-del" onClick={() => del(n)} title={`Delete “${n}”`} aria-label={`Delete ${n}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  <button className="wrap-preset-new" onClick={newPreset}>
                    + New
                  </button>
                </div>
                <input
                  className="panel-input wrap-name"
                  placeholder="Wrapper name…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Wrapper name"
                />
              </div>

              {/* The two horizontally-grouped editors */}
              <div className="wrap-grid">
                <label className="wrap-box">
                  <span className="wrap-box-label">Start</span>
                  <textarea
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    placeholder="Rendered before the prompt — e.g. masterpiece, best quality"
                    spellCheck={false}
                  />
                </label>
                <label className="wrap-box">
                  <span className="wrap-box-label">End</span>
                  <textarea
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    placeholder="Rendered after the prompt — e.g. {#fx}, {#artists}"
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>

            <div className="wrap-modal-foot">
              <span className="wrap-foot-hint">Wraps every generated prompt: start, your prompt, end.</span>
              <div className="grow" />
              <button className="ghost" onClick={() => setView("list")}>
                Cancel
              </button>
              <button className="primary" onClick={save} disabled={!name.trim()}>
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
