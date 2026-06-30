/**
 * Manage → Storage / Cache panel: view and manage **everything in storage** — every namespace the
 * app has persisted (settings, wrappers, presets, and one file per provider). Reads straight from
 * the active backend (the user-settings folder locally; localStorage online), so it shows the true
 * on-disk/in-browser state, independent of the in-memory hydration cache. Supports inspecting a
 * namespace's JSON, deleting one, clearing all, and export/import for moving settings between
 * machines. Destructive actions reload the app afterward so the live settings re-hydrate cleanly.
 * @module gui/components/manage/ManageStorage
 */
import { useCallback, useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { storage } from "../../../storage/index.js";

const msgs = defineMessages({
  title: { id: "storage.title", defaultMessage: "Storage / Cache" },
  intro: {
    id: "storage.intro",
    defaultMessage:
      "Everything this app has saved. Locally these are JSON files in your user-settings folder; online they live only in this browser. No cookies are ever used.",
  },
  refresh: { id: "storage.refresh", defaultMessage: "Reload" },
  empty: { id: "storage.empty", defaultMessage: "Nothing is stored yet." },
  view: { id: "storage.view", defaultMessage: "View" },
  hide: { id: "storage.hide", defaultMessage: "Hide" },
  del: { id: "storage.delete", defaultMessage: "Delete" },
  delConfirm: {
    id: "storage.deleteConfirm",
    defaultMessage: "Delete “{ns}” from storage? The app will reload.",
  },
  clearAll: { id: "storage.clearAll", defaultMessage: "Clear all" },
  clearConfirm: {
    id: "storage.clearConfirm",
    defaultMessage: "Delete ALL stored data ({n} items)? This resets every setting. The app will reload.",
  },
  exportBtn: { id: "storage.export", defaultMessage: "Export" },
  importBtn: { id: "storage.import", defaultMessage: "Import" },
  importConfirm: {
    id: "storage.importConfirm",
    defaultMessage: "Import {n} item(s) into storage, overwriting matching ones? The app will reload.",
  },
  importBad: { id: "storage.importBad", defaultMessage: "That file isn’t a valid storage export." },
  close: { id: "storage.close", defaultMessage: "Close" },
});

/**
 * @param {object} props
 * @param {Function} [props.onClose] Close the panel (back to the catalog editor).
 * @returns {JSX.Element}
 */
export default function ManageStorage({ onClose }) {
  const intl = useIntl();
  const [items, setItems] = useState(null); // [{ ns, value }]
  const [open, setOpen] = useState({}); // ns → expanded?
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const keys = await storage.keys();
      keys.sort();
      const rows = await Promise.all(keys.map(async (ns) => ({ ns, value: await storage.get(ns) })));
      setItems(rows);
    } catch (e) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = () => window.location.reload();

  async function removeOne(ns) {
    if (!confirm(intl.formatMessage(msgs.delConfirm, { ns }))) return;
    await storage.remove(ns);
    reload();
  }

  async function clearAll() {
    const keys = (items || []).map((i) => i.ns);
    if (!keys.length) return;
    if (!confirm(intl.formatMessage(msgs.clearConfirm, { n: keys.length }))) return;
    await Promise.all(keys.map((ns) => storage.remove(ns)));
    reload();
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(Object.fromEntries((items || []).map((i) => [i.ns, i.value])), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `random-ai-prompt-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file) {
    setErr("");
    let data;
    try {
      data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    } catch {
      setErr(intl.formatMessage(msgs.importBad));
      return;
    }
    const entries = Object.entries(data);
    if (!confirm(intl.formatMessage(msgs.importConfirm, { n: entries.length }))) return;
    await Promise.all(entries.map(([ns, value]) => storage.set(ns, value)));
    reload();
  }

  return (
    <div className="mg-storage" style={{ padding: "1rem", overflow: "auto" }}>
      <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
        <h3 className="panel-title">{intl.formatMessage(msgs.title)}</h3>
        <div style={{ flex: 1 }} />
        <button onClick={load} disabled={busy}>
          {intl.formatMessage(msgs.refresh)}
        </button>
        <button onClick={exportAll} disabled={!items?.length}>
          {intl.formatMessage(msgs.exportBtn)}
        </button>
        <label className="btn-like" style={{ cursor: "pointer" }}>
          {intl.formatMessage(msgs.importBtn)}
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) importFile(f);
            }}
          />
        </label>
        <button onClick={clearAll} disabled={!items?.length} className="danger">
          {intl.formatMessage(msgs.clearAll)}
        </button>
        {onClose && <button onClick={onClose}>{intl.formatMessage(msgs.close)}</button>}
      </div>

      <p className="hint" style={{ opacity: 0.75 }}>
        {intl.formatMessage(msgs.intro)}
      </p>
      {err && <p className="error">{err}</p>}

      {items === null ? null : items.length === 0 ? (
        <p className="empty">{intl.formatMessage(msgs.empty)}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map(({ ns, value }) => (
            <li key={ns} style={{ borderTop: "1px solid var(--border, #3a3a3a)", padding: ".5rem 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <code style={{ flex: 1, wordBreak: "break-all" }}>{ns}</code>
                <button onClick={() => setOpen((o) => ({ ...o, [ns]: !o[ns] }))}>
                  {intl.formatMessage(open[ns] ? msgs.hide : msgs.view)}
                </button>
                <button onClick={() => removeOne(ns)} className="danger">
                  {intl.formatMessage(msgs.del)}
                </button>
              </div>
              {open[ns] && (
                <pre
                  style={{
                    margin: ".5rem 0 0",
                    padding: ".5rem",
                    background: "var(--code-bg, #1e1e1e)",
                    borderRadius: 4,
                    overflow: "auto",
                    maxHeight: 280,
                  }}
                >
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
