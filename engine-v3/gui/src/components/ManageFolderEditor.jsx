/**
 * The folder / category settings editor for the Manage tab. Edits a folder's name, its `.json`
 * sidecar (priority, description, and — for lists — forceList), and its `_`-markers abstracted into
 * plain controls: a Force-prefix toggle and a group mode (Auto / Always / Never, backed by the
 * `_enable-group-list` / `_disable-group-list` markers). Saving hot-applies via `onChanged`.
 * @module gui/components/ManageFolderEditor
 */
import { useEffect, useState } from "react";
import { readFile, saveSidecar, setMarker, fsOp } from "../lib/manageApi.js";

/**
 * @param {object} props
 * @param {object} props.node The folder model node `{ root, path, name, isCategory, forcePrefix, enableGroup, disableGroup }`.
 * @param {Function} props.onChanged Called after a save/rename to hot-apply + refresh. Gets the new path on rename.
 * @returns {JSX.Element}
 */
export default function ManageFolderEditor({ node, onChanged }) {
  const { root, path } = node;
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [forceList, setForceList] = useState(false);
  const [forcePrefix, setForcePrefix] = useState(node.forcePrefix);
  const [groupMode, setGroupMode] = useState(
    node.enableGroup ? "always" : node.disableGroup ? "never" : "auto",
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setStatus("");
    setName(node.name);
    setForcePrefix(node.forcePrefix);
    setGroupMode(node.enableGroup ? "always" : node.disableGroup ? "never" : "auto");
    (async () => {
      let meta = {};
      try {
        meta = JSON.parse(await readFile(root, `${path}.json`));
      } catch {
        meta = {};
      }
      if (!alive) return;
      setDescription(meta.description || "");
      setPriority(typeof meta.priority === "number" ? String(meta.priority) : "");
      setForceList(meta.forceList === true);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, path]);

  async function save() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const prioNum = priority.trim() === "" ? null : Number(priority);
      await saveSidecar(root, path, {
        description: description.trim() || null,
        priority: Number.isFinite(prioNum) ? prioNum : null,
        forceList: root === "lists" && forceList ? true : null,
      });
      await setMarker(root, path, "_force-prefix", forcePrefix);
      await setMarker(root, path, "_enable-group-list", groupMode === "always");
      await setMarker(root, path, "_disable-group-list", groupMode === "never");
      setStatus("Saved.");
      await onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function rename() {
    const clean = name.trim().replace(/\//g, "");
    if (!clean || clean === node.name) return;
    const target = parent ? `${parent}/${clean}` : clean;
    setSaving(true);
    setError("");
    try {
      await fsOp("move", { root, path, to: target });
      try {
        await fsOp("move", { root, path: `${path}.json`, to: `${target}.json` });
      } catch {
        // no folder sidecar to move
      }
      setStatus("Renamed.");
      await onChanged?.({ ...node, path: target, name: clean });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete the folder "${node.name}" and everything in it (${node.entryCount} entr${node.entryCount === 1 ? "y" : "ies"})? This can't be undone.`,
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      await fsOp("delete", { root, path });
      try {
        await fsOp("delete", { root, path: `${path}.json` });
      } catch {
        /* no folder sidecar */
      }
      await onChanged?.({ deleted: true });
    } catch (e) {
      setError(e.message || String(e));
      setSaving(false);
    }
  }

  if (loading) return <section className="card mg-detail"><p className="empty">Loading…</p></section>;

  return (
    <section className="card mg-detail mg-editor">
      <div className="mg-editor-head">
        <input
          className="mg-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Folder name"
        />
        <span className="mg-kind">{node.isCategory ? "category" : "folder"}</span>
        <button className="link-btn" onClick={rename} disabled={saving || name.trim() === node.name}>
          Rename
        </button>
        <div className="grow" />
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <p className="mg-path">
        <code>{root}/{path}</code>
      </p>

      <label className="mg-field">
        <span>Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Category tooltip" />
      </label>

      <label className="mg-field">
        <span>Priority</span>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder="1000 (lower sorts higher; blank = default)"
        />
      </label>

      <label className="mg-field mg-check">
        <input type="checkbox" checked={forcePrefix} onChange={(e) => setForcePrefix(e.target.checked)} />
        <span title="Show this folder's path in the token (e.g. d/general)">Force prefix</span>
      </label>

      <label className="mg-field">
        <span>Group mode</span>
        <select value={groupMode} onChange={(e) => setGroupMode(e.target.value)}>
          <option value="auto">Auto (group when it has 2+ members)</option>
          <option value="always">Always a group</option>
          <option value="never">Never a group</option>
        </select>
      </label>

      {root === "lists" && (
        <label className="mg-field mg-check">
          <input type="checkbox" checked={forceList} onChange={(e) => setForceList(e.target.checked)} />
          <span title="Keep this folder as its own sub-category even with a single list">Force list category</span>
        </label>
      )}

      <div className="mg-editor-foot">
        <button className="link-btn mg-danger" onClick={remove} disabled={saving}>
          Delete folder
        </button>
        {status && <span className="mg-ok">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
