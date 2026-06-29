/**
 * The "wrapper" control: a floating bottom-right button that frames every generated prompt
 * with a START and an END snippet (the v3 root layer = open + middle + close). Clicking it
 * opens a small popover listing saved wrapper presets (apply one, or "None"); a "Manage
 * presets" button there opens a modal with the two side-by-side Start/End editors plus
 * preset naming/management. The selected wrapper lives in `settings.wrapper` (so it is
 * shared by the share-link); the preset library lives in localStorage.
 * @module gui/components/WrapperFab
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import DplEditor from "./DplEditor.jsx";
import {
  getWrappers,
  saveWrapper,
  removeWrapper,
  renameWrapper,
  getDefaultWrapper,
  saveDefaultWrapper,
  DEFAULT_WRAPPER_SEED,
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
// Counter-clockwise arrow — "revert to default".
const RevertIcon = () => (
  <svg {...ico} width={15} height={15} aria-hidden="true">
    <path d="M3 4v6h6" />
    <path d="M3.5 10a8 8 0 1 1-.5 6" />
  </svg>
);

const msgs = defineMessages({
  triggerTitle: {
    id: "wrapper.triggerTitle",
    defaultMessage: "Wrapper: {name} — frames every prompt with a start and end",
  },
  presetsAria: { id: "wrapper.presetsAria", defaultMessage: "Wrapper presets" },
  wrapperHead: { id: "wrapper.head", defaultMessage: "Wrapper" },
  manage: { id: "wrapper.manage", defaultMessage: "Manage Wrappers" },
  autoToggleTitle: {
    id: "wrapper.autoToggleTitle",
    defaultMessage:
      "When on, blocks may add their own Auto Begin / Auto End framing to the prompt. When off, only this wrapper frames it.",
  },
  autoToggleLabel: {
    id: "wrapper.autoToggleLabel",
    defaultMessage: "Allow used blocks to extend current wrapper",
  },
  nameDefault: { id: "wrapper.nameDefault", defaultMessage: "Default" },
  nameNone: { id: "wrapper.nameNone", defaultMessage: "None" },
  noSaved: {
    id: "wrapper.noSaved",
    defaultMessage: "No saved wrappers — Manage presets to add one.",
  },
  manageAria: { id: "wrapper.manageAria", defaultMessage: "Manage wrappers" },
  close: { id: "wrapper.close", defaultMessage: "Close" },
  editDefault: { id: "wrapper.editDefault", defaultMessage: "Edit the Default wrapper" },
  editPreset: { id: "wrapper.editPreset", defaultMessage: "Edit “{name}”" },
  deletePreset: { id: "wrapper.deletePreset", defaultMessage: "Delete “{name}”" },
  deletePresetAria: { id: "wrapper.deletePresetAria", defaultMessage: "Delete {name}" },
  newPreset: { id: "wrapper.newPreset", defaultMessage: "+ New" },
  namePlaceholder: { id: "wrapper.namePlaceholder", defaultMessage: "Wrapper name…" },
  nameAria: { id: "wrapper.nameAria", defaultMessage: "Wrapper name" },
  start: { id: "wrapper.start", defaultMessage: "Start" },
  end: { id: "wrapper.end", defaultMessage: "End" },
  revertStartDefault: {
    id: "wrapper.revertStartDefault",
    defaultMessage: "Reset Start to the built-in default",
  },
  revertStartNormal: {
    id: "wrapper.revertStartNormal",
    defaultMessage: "Reset Start to the default wrapper",
  },
  revertEndDefault: {
    id: "wrapper.revertEndDefault",
    defaultMessage: "Reset End to the built-in default",
  },
  revertEndNormal: {
    id: "wrapper.revertEndNormal",
    defaultMessage: "Reset End to the default wrapper",
  },
  revertStartAria: { id: "wrapper.revertStartAria", defaultMessage: "Revert Start to default" },
  revertEndAria: { id: "wrapper.revertEndAria", defaultMessage: "Revert End to default" },
  startAria: { id: "wrapper.startAria", defaultMessage: "Wrapper start (DPL)" },
  endAria: { id: "wrapper.endAria", defaultMessage: "Wrapper end (DPL)" },
  startPlaceholderNew: {
    id: "wrapper.startPlaceholderNew",
    defaultMessage: "Rendered before the prompt…",
  },
  startPlaceholder: {
    id: "wrapper.startPlaceholder",
    defaultMessage: "Rendered before the prompt — e.g. a style or framing lead-in",
  },
  endPlaceholderNew: {
    id: "wrapper.endPlaceholderNew",
    defaultMessage: "Rendered after the prompt…",
  },
  endPlaceholder: {
    id: "wrapper.endPlaceholder",
    defaultMessage: "Rendered after the prompt — e.g. '{#fx}', '{#artists}'",
  },
  footHint: {
    id: "wrapper.footHint",
    defaultMessage: "Wraps every generated prompt: start, your prompt, end.",
  },
  cancel: { id: "wrapper.cancel", defaultMessage: "Cancel" },
  save: { id: "wrapper.save", defaultMessage: "Save" },
});

/**
 * @param {object} props
 * @param {object} props.settings Current settings (reads `wrapper` / `wrapperName`).
 * @param {Function} props.setSettings Update settings.
 * @returns {JSX.Element}
 */
export default function WrapperFab({ settings, setSettings }) {
  const intl = useIntl();
  // The built-in "Default" / "None" presets are stored under those literal keys but shown
  // localized; custom preset names are user content and shown verbatim.
  const displayName = (n) =>
    n === "Default"
      ? intl.formatMessage(msgs.nameDefault)
      : n === "None"
        ? intl.formatMessage(msgs.nameNone)
        : n;
  const [view, setView] = useState(""); // "" | "list" | "manage"
  const [wrappers, setWrappers] = useState(() => getWrappers());
  const refresh = () => setWrappers(getWrappers());

  // The popover is position:fixed (so it escapes the scrolling pane and can't clip); anchor its
  // bottom-right to just above the trigger button.
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  function openList() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r)
      setPos({
        right: Math.round(window.innerWidth - r.right),
        bottom: Math.round(window.innerHeight - r.top + 8),
        // Never let the popover grow past the top of the screen — cap it to the gap above the button.
        maxHeight: Math.max(160, Math.round(r.top - 16)),
      });
    setView("list");
  }

  // Manage-modal editor state.
  const [sel, setSel] = useState(""); // the preset name being edited ("" = unsaved/new)
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // No explicit choice yet → the built-in Default is in effect. "None" means "no wrapper".
  const activeName = settings.wrapperName ?? "Default";
  const isActive = activeName !== "None";
  const names = Object.keys(wrappers).sort((a, b) => a.localeCompare(b));
  const def = getDefaultWrapper(); // live Default — used for placeholders on a brand-new wrapper
  const isNew = sel === ""; // editing a brand-new (unsaved) wrapper

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
      setSettings({ ...settings, wrapper: getDefaultWrapper(), wrapperName: "Default" });
    } else {
      const w = wrappers[n] || { start: "", end: "" };
      setSettings({ ...settings, wrapper: { start: w.start, end: w.end }, wrapperName: n });
    }
    setView("");
  }

  // Load a preset (by name, "Default", or "" = a brand-new one) into the editor.
  function loadInto(n) {
    if (n === "Default") {
      const w = getDefaultWrapper();
      setSel("Default");
      setName("Default");
      setStart(w.start || "");
      setEnd(w.end || "");
      return;
    }
    const w = (n && getWrappers()[n]) || { start: "", end: "" };
    setSel(n && getWrappers()[n] ? n : "");
    setName(n && getWrappers()[n] ? n : "");
    setStart(w.start || "");
    setEnd(w.end || "");
  }

  function openManage(n = activeName) {
    refresh();
    loadInto(n === "None" ? "Default" : n);
    setView("manage");
  }

  function editPreset(n) {
    loadInto(n);
  }

  // A brand-new wrapper: clear the fields (the Default's text shows as placeholder instead).
  function newPreset() {
    setSel("");
    setName("");
    setStart("");
    setEnd("");
  }

  function save() {
    const n = name.trim();
    if (!n) return;
    // The Default is special: it's edited in place (you can't rename it into a normal preset).
    if (sel === "Default" && n === "Default") {
      saveDefaultWrapper({ start, end });
      if (!activeName || activeName === "Default") {
        setSettings({ ...settings, wrapper: { start, end }, wrapperName: "Default" });
      }
      return;
    }
    if (sel && sel !== "Default" && sel !== n) renameWrapper(sel, n); // renamed an existing preset
    saveWrapper(n, { start, end });
    refresh();
    setSel(n);
    // If we were editing the active wrapper (or it now matches), keep it applied/in sync.
    if (!activeName || activeName === sel || activeName === n) {
      setSettings({ ...settings, wrapper: { start, end }, wrapperName: n });
    }
  }

  function del(n) {
    if (n === "Default") return; // the Default can't be deleted (reset it instead)
    removeWrapper(n);
    refresh();
    if (sel === n) loadInto("Default");
    // If the deleted preset was applied, fall back to the built-in Default.
    if (activeName === n) setSettings({ ...settings, wrapper: getDefaultWrapper(), wrapperName: "Default" });
  }

  // Revert ONE pane to the default: pull from the live Default file, or — when the Default itself is
  // being edited — from the hard-coded seed (the "hard copy"). Only sets the field; Save persists it.
  function revertPane(which) {
    const src = sel === "Default" ? DEFAULT_WRAPPER_SEED : getDefaultWrapper();
    if (which === "start") setStart(src.start || "");
    else setEnd(src.end || "");
  }

  return (
    <>
      <button
        ref={btnRef}
        className={`field-act wrap-trigger${isActive ? " on" : ""}`}
        onClick={() => (view === "list" ? setView("") : openList())}
        title={intl.formatMessage(msgs.triggerTitle, { name: displayName(activeName) })}
        aria-label={intl.formatMessage(msgs.presetsAria)}
        aria-pressed={view === "list"}
      >
        <WrapIcon />
      </button>

      {view === "list" && (
        <>
          <div className="wrap-pop-scrim" onClick={() => setView("")} />
          <div
            className="wrap-pop"
            role="menu"
            aria-label={intl.formatMessage(msgs.presetsAria)}
            style={pos ? { position: "fixed", right: pos.right, bottom: pos.bottom, maxHeight: pos.maxHeight } : undefined}
          >
            <div className="wrap-pop-head">
              <span>{intl.formatMessage(msgs.wrapperHead)}</span>
              <button className="wrap-manage-btn" onClick={() => openManage()}>
                {intl.formatMessage(msgs.manage)}
              </button>
            </div>
            <label className="wrap-auto-toggle" title={intl.formatMessage(msgs.autoToggleTitle)}>
              <input
                type="checkbox"
                checked={settings.useAutoSections !== false}
                onChange={(e) => setSettings({ ...settings, useAutoSections: e.target.checked })}
              />
              <span>{intl.formatMessage(msgs.autoToggleLabel)}</span>
            </label>
            <div className="wrap-pop-list">
              <button
                className={`wrap-pop-item${activeName === "Default" ? " on" : ""}`}
                onClick={() => applyWrapper("Default")}
              >
                <span className="wrap-pop-name">{intl.formatMessage(msgs.nameDefault)}</span>
                {activeName === "Default" && <span className="wrap-check">✓</span>}
              </button>
              <button
                className={`wrap-pop-item${activeName === "None" ? " on" : ""}`}
                onClick={() => applyWrapper("None")}
              >
                <span className="wrap-pop-name">{intl.formatMessage(msgs.nameNone)}</span>
                {activeName === "None" && <span className="wrap-check">✓</span>}
              </button>
              {names.length === 0 && (
                <p className="wrap-empty">{intl.formatMessage(msgs.noSaved)}</p>
              )}
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
          <div className="wrap-modal" role="dialog" aria-label={intl.formatMessage(msgs.manageAria)}>
            <div className="wrap-modal-head">
              <h2>{intl.formatMessage(msgs.manage)}</h2>
              <div className="grow" />
              <button
                className="drawer-close"
                onClick={() => setView("list")}
                aria-label={intl.formatMessage(msgs.close)}
              >
                ×
              </button>
            </div>

            <div className="wrap-modal-body">
              {/* Preset management row */}
              <div className="wrap-presets">
                <div className="wrap-preset-pills">
                  {/* The Default is always present and can't be deleted (use the per-pane revert to reset). */}
                  <span className={`wrap-preset-pill${sel === "Default" ? " on" : ""}`}>
                    <button className="wrap-preset-pick" onClick={() => editPreset("Default")} title={intl.formatMessage(msgs.editDefault)}>
                      {intl.formatMessage(msgs.nameDefault)}
                    </button>
                  </span>
                  {names.map((n) => (
                    <span key={n} className={`wrap-preset-pill${sel === n ? " on" : ""}`}>
                      <button className="wrap-preset-pick" onClick={() => editPreset(n)} title={intl.formatMessage(msgs.editPreset, { name: n })}>
                        {n}
                      </button>
                      <button className="wrap-preset-del" onClick={() => del(n)} title={intl.formatMessage(msgs.deletePreset, { name: n })} aria-label={intl.formatMessage(msgs.deletePresetAria, { name: n })}>
                        ×
                      </button>
                    </span>
                  ))}
                  <button className="wrap-preset-new" onClick={newPreset}>
                    {intl.formatMessage(msgs.newPreset)}
                  </button>
                </div>
                <input
                  className="panel-input wrap-name"
                  placeholder={intl.formatMessage(msgs.namePlaceholder)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={sel === "Default"}
                  aria-label={intl.formatMessage(msgs.nameAria)}
                />
              </div>

              {/* The two horizontally-grouped editors */}
              <div className="wrap-grid">
                <label className="wrap-box">
                  <span className="wrap-box-head">
                    <span className="wrap-box-label">{intl.formatMessage(msgs.start)}</span>
                    <button
                      type="button"
                      className="wrap-revert"
                      onClick={() => revertPane("start")}
                      title={intl.formatMessage(sel === "Default" ? msgs.revertStartDefault : msgs.revertStartNormal)}
                      aria-label={intl.formatMessage(msgs.revertStartAria)}
                    >
                      <RevertIcon />
                    </button>
                  </span>
                  <DplEditor
                    value={start}
                    onChange={setStart}
                    settings={settings}
                    ariaLabel={intl.formatMessage(msgs.startAria)}
                    placeholder={isNew ? def.start || intl.formatMessage(msgs.startPlaceholderNew) : intl.formatMessage(msgs.startPlaceholder)}
                  />
                </label>
                <label className="wrap-box">
                  <span className="wrap-box-head">
                    <span className="wrap-box-label">{intl.formatMessage(msgs.end)}</span>
                    <button
                      type="button"
                      className="wrap-revert"
                      onClick={() => revertPane("end")}
                      title={intl.formatMessage(sel === "Default" ? msgs.revertEndDefault : msgs.revertEndNormal)}
                      aria-label={intl.formatMessage(msgs.revertEndAria)}
                    >
                      <RevertIcon />
                    </button>
                  </span>
                  <DplEditor
                    value={end}
                    onChange={setEnd}
                    settings={settings}
                    ariaLabel={intl.formatMessage(msgs.endAria)}
                    placeholder={isNew ? def.end || intl.formatMessage(msgs.endPlaceholderNew) : intl.formatMessage(msgs.endPlaceholder)}
                  />
                </label>
              </div>
            </div>

            <div className="wrap-modal-foot">
              <span className="wrap-foot-hint">{intl.formatMessage(msgs.footHint)}</span>
              <div className="grow" />
              <button className="ghost" onClick={() => setView("list")}>
                {intl.formatMessage(msgs.cancel)}
              </button>
              <button className="primary" onClick={save} disabled={!name.trim()}>
                {intl.formatMessage(msgs.save)}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
