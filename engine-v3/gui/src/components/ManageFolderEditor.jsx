/**
 * The folder / category settings editor for the Manage tab. Edits a folder's name, its `.json`
 * sidecar (priority, description, and — for lists — forceList), and its `_`-markers abstracted into
 * plain controls: a Force-prefix toggle and a group mode (Auto / Always / Never, backed by the
 * `_enable-group-list` / `_disable-group-list` markers). Saving hot-applies via `onChanged`.
 * @module gui/components/ManageFolderEditor
 */
import { useEffect, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { readFile, saveSidecar, setMarker, fsOp } from "../lib/manageApi.js";

const msgs = defineMessages({
  folderName: { id: "folderEd.folderName", defaultMessage: "Folder name" },
  category: { id: "folderEd.category", defaultMessage: "category" },
  folder: { id: "folderEd.folder", defaultMessage: "folder" },
  rename: { id: "folderEd.rename", defaultMessage: "Rename" },
  saving: { id: "folderEd.saving", defaultMessage: "Saving…" },
  save: { id: "folderEd.save", defaultMessage: "Save" },
  description: { id: "folderEd.description", defaultMessage: "Description" },
  descriptionPh: { id: "folderEd.descriptionPh", defaultMessage: "Category tooltip" },
  priority: { id: "folderEd.priority", defaultMessage: "Priority" },
  priorityPh: {
    id: "folderEd.priorityPh",
    defaultMessage: "1000 (lower sorts higher; blank = default)",
  },
  forcePrefixTitle: {
    id: "folderEd.forcePrefixTitle",
    defaultMessage: "Show this folder's path in the token (e.g. d/general)",
  },
  forcePrefix: { id: "folderEd.forcePrefix", defaultMessage: "Force prefix" },
  groupMode: { id: "folderEd.groupMode", defaultMessage: "Group mode" },
  groupAuto: { id: "folderEd.groupAuto", defaultMessage: "Auto (group when it has 2+ members)" },
  groupAlways: { id: "folderEd.groupAlways", defaultMessage: "Always a group" },
  groupNever: { id: "folderEd.groupNever", defaultMessage: "Never a group" },
  forceListTitle: {
    id: "folderEd.forceListTitle",
    defaultMessage: "Keep this folder as its own sub-category even with a single list",
  },
  forceList: { id: "folderEd.forceList", defaultMessage: "Force list category" },
  deleteFolder: { id: "folderEd.deleteFolder", defaultMessage: "Delete folder" },
  loading: { id: "folderEd.loading", defaultMessage: "Loading…" },
  saved: { id: "folderEd.saved", defaultMessage: "Saved." },
  renamed: { id: "folderEd.renamed", defaultMessage: "Renamed." },
  deleteConfirm: {
    id: "folderEd.deleteConfirm",
    defaultMessage:
      'Delete the folder "{name}" and everything in it ({count, plural, one {# entry} other {# entries}})? This can\'t be undone.',
  },
});

/**
 * @param {object} props
 * @param {object} props.node The folder model node `{ root, path, name, isCategory, forcePrefix, enableGroup, disableGroup }`.
 * @param {Function} props.onChanged Called after a save/rename to hot-apply + refresh. Gets the new path on rename.
 * @returns {JSX.Element}
 */
export default function ManageFolderEditor({ node, onChanged }) {
  const intl = useIntl();
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
      setStatus(intl.formatMessage(msgs.saved));
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
      setStatus(intl.formatMessage(msgs.renamed));
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
        intl.formatMessage(msgs.deleteConfirm, { name: node.name, count: node.entryCount }),
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

  if (loading)
    return (
      <section className="card mg-detail">
        <p className="empty">{intl.formatMessage(msgs.loading)}</p>
      </section>
    );

  return (
    <section className="card mg-detail mg-editor">
      <div className="mg-editor-head">
        <input
          className="mg-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={intl.formatMessage(msgs.folderName)}
        />
        <span className="mg-kind">
          {intl.formatMessage(node.isCategory ? msgs.category : msgs.folder)}
        </span>
        <button className="link-btn" onClick={rename} disabled={saving || name.trim() === node.name}>
          {intl.formatMessage(msgs.rename)}
        </button>
        <div className="grow" />
        <button className="primary" onClick={save} disabled={saving}>
          {intl.formatMessage(saving ? msgs.saving : msgs.save)}
        </button>
      </div>

      <p className="mg-path">
        <code>{root}/{path}</code>
      </p>

      <label className="mg-field">
        <span>{intl.formatMessage(msgs.description)}</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={intl.formatMessage(msgs.descriptionPh)} />
      </label>

      <label className="mg-field">
        <span>{intl.formatMessage(msgs.priority)}</span>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder={intl.formatMessage(msgs.priorityPh)}
        />
      </label>

      <label className="mg-field mg-check">
        <input type="checkbox" checked={forcePrefix} onChange={(e) => setForcePrefix(e.target.checked)} />
        <span title={intl.formatMessage(msgs.forcePrefixTitle)}>{intl.formatMessage(msgs.forcePrefix)}</span>
      </label>

      <label className="mg-field">
        <span>{intl.formatMessage(msgs.groupMode)}</span>
        <select value={groupMode} onChange={(e) => setGroupMode(e.target.value)}>
          <option value="auto">{intl.formatMessage(msgs.groupAuto)}</option>
          <option value="always">{intl.formatMessage(msgs.groupAlways)}</option>
          <option value="never">{intl.formatMessage(msgs.groupNever)}</option>
        </select>
      </label>

      {root === "lists" && (
        <label className="mg-field mg-check">
          <input type="checkbox" checked={forceList} onChange={(e) => setForceList(e.target.checked)} />
          <span title={intl.formatMessage(msgs.forceListTitle)}>{intl.formatMessage(msgs.forceList)}</span>
        </label>
      )}

      <div className="mg-editor-foot">
        <button className="link-btn mg-danger" onClick={remove} disabled={saving}>
          {intl.formatMessage(msgs.deleteFolder)}
        </button>
        {status && <span className="mg-ok">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
