/**
 * @file The wrapper-preset control's state + behavior as a hook: the popover/modal view state and
 * anchor, the saved-preset library (localStorage-backed via wrapperStore), the Start/End editor
 * draft, and every action (apply a preset, load into the editor, save / rename / delete, per-pane
 * revert). The WrapperFab component is left as pure rendering over what this returns.
 * Covered by gui/tests/lib/useWrapperPresets.test.jsx.
 */
import { useEffect, useRef, useState } from "react";
import {
  getWrappers,
  saveWrapper,
  removeWrapper,
  renameWrapper,
  getDefaultWrapper,
  saveDefaultWrapper,
  DEFAULT_WRAPPER_SEED,
} from "../wrapperStore.js";

/**
 * Wrapper-preset state + actions.
 * @param {object} args
 * @param {object} args.settings App settings (`wrapper`, `wrapperName`, `useAutoSections`).
 * @param {Function} args.setSettings Update settings.
 * @returns {object} View state, the preset library, the editor draft, and the actions.
 */
export function useWrapperPresets({ settings, setSettings }) {
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

  return {
    view,
    setView,
    pos,
    btnRef,
    openList,
    wrappers,
    names,
    activeName,
    isActive,
    def,
    isNew,
    sel,
    name,
    setName,
    start,
    setStart,
    end,
    setEnd,
    applyWrapper,
    loadInto,
    openManage,
    editPreset,
    newPreset,
    save,
    del,
    revertPane,
  };
}
