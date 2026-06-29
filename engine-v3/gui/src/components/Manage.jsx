/**
 * The Manage tab — the in-app content manager. Same two-pane skeleton as Generate, but instead of
 * composing prompts it edits the catalog: a real, nested folder tree of the two data roots
 * (Blocks = dynamic-prompts, Lists = lists) on the left, and a big editor pane on the right.
 *
 * This is the read-only-tree foundation (phase 2): the tree shows the actual on-disk structure with
 * categories vs subfolders color-coded, force-prefix / implied-group folders badged, `_`-markers
 * abstracted into those badges, NSFW gated by the header toggle, a search filter, and a Refresh
 * button. Each folder has a gear by its name and each entry a hover Edit action; both select the
 * item into the right pane (the actual editors arrive in the next phases). Local mode only — when the
 * management backend isn't present (online build / static host) the tab is locked upstream in `App`.
 * @module gui/components/Manage
 */
import { useEffect, useMemo, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getTree, getRemoteManifest, restoreDefault, fsOp } from "../lib/manageApi.js";
import { refreshCatalog, subscribeCatalog } from "../lib/promptEngine.js";
import { buildManageModel, filterModel, computeGhosts, injectGhosts } from "../lib/manageTree.js";
import ManageBlockEditor from "./ManageBlockEditor.jsx";
import ManageFolderEditor from "./ManageFolderEditor.jsx";
import ManageListEditor from "./ManageListEditor.jsx";
import ManageDetail from "./manage/ManageDetail.jsx";
import { Caret, GearIcon, EditIcon, RefreshIcon, RestoreIcon, TrashIcon } from "./manage/icons.jsx";

// Data-root keys are fixed; their display titles are localized via `msgs` below.
const ROOTS = ["dynamic-prompts", "lists"];

const msgs = defineMessages({
  blocks: { id: "manage.blocks", defaultMessage: "Blocks" },
  lists: { id: "manage.lists", defaultMessage: "Lists" },
  newFilePromptList: { id: "manage.newFilePromptList", defaultMessage: "New list name:" },
  newFilePromptBlock: { id: "manage.newFilePromptBlock", defaultMessage: "New block name:" },
  newFolderPrompt: { id: "manage.newFolderPrompt", defaultMessage: "New subfolder name:" },
  deleteEntryConfirm: {
    id: "manage.deleteEntryConfirm",
    defaultMessage: "Delete {label} ({root}/{path})? This removes the file from disk.",
  },
  ghostTitle: {
    id: "manage.ghostTitle",
    defaultMessage: "{path} — deleted locally; restore from the repo",
  },
  ghostTag: { id: "manage.ghostTag", defaultMessage: "ghost" },
  restoreTitle: { id: "manage.restoreTitle", defaultMessage: "Restore {label} from the repo" },
  restoreAria: { id: "manage.restoreAria", defaultMessage: "Restore {label}" },
  nsfw: { id: "manage.nsfw", defaultMessage: "NSFW" },
  nsfwTag: { id: "manage.nsfwTag", defaultMessage: "18+" },
  jsTitle: { id: "manage.jsTitle", defaultMessage: "Has a JS sidecar" },
  jsTag: { id: "manage.jsTag", defaultMessage: "JS" },
  editTitle: { id: "manage.editTitle", defaultMessage: "Edit {label}" },
  deleteTitle: { id: "manage.deleteTitle", defaultMessage: "Delete {label}" },
  lockedTitle: { id: "manage.lockedTitle", defaultMessage: "Manage is a local-mode feature" },
  lockedBody: {
    id: "manage.lockedBody",
    defaultMessage:
      "The content manager edits the prompt files on your disk, so it needs the local app (the dev server or a local build). It isn’t available in the online version.",
  },
  collapse: { id: "manage.collapse", defaultMessage: "Collapse" },
  expand: { id: "manage.expand", defaultMessage: "Expand" },
  folderSettings: { id: "manage.folderSettings", defaultMessage: "Folder settings — {name}" },
  settingsFor: { id: "manage.settingsFor", defaultMessage: "Settings for {name}" },
  addTo: { id: "manage.addTo", defaultMessage: "Add to {name}" },
  newList: { id: "manage.newList", defaultMessage: "New list" },
  newBlock: { id: "manage.newBlock", defaultMessage: "New block" },
  newSubfolder: { id: "manage.newSubfolder", defaultMessage: "New subfolder" },
  newFolder: { id: "manage.newFolder", defaultMessage: "New folder" },
  badgePrefix: { id: "manage.badgePrefix", defaultMessage: "prefix" },
  badgeGroup: { id: "manage.badgeGroup", defaultMessage: "group" },
  badgeForcePrefixTitle: {
    id: "manage.badgeForcePrefixTitle",
    defaultMessage: "Force-prefix folder — its path shows in the token",
  },
  badgeGroupTitle: {
    id: "manage.badgeGroupTitle",
    defaultMessage: "Group folder — referencing it picks one random member",
  },
  panelTitle: { id: "manage.panelTitle", defaultMessage: "Manage" },
  searchPh: { id: "manage.searchPh", defaultMessage: "Search…" },
  refreshTitle: { id: "manage.refreshTitle", defaultMessage: "Refresh catalog (re-read from disk)" },
  refreshAria: { id: "manage.refreshAria", defaultMessage: "Refresh catalog" },
  loadingCatalog: { id: "manage.loadingCatalog", defaultMessage: "Loading the catalog…" },
  nothingMatches: { id: "manage.nothingMatches", defaultMessage: "Nothing matches." },
});

/** Collect the paths of every category (depth-1) folder, to expand them by default. */
function defaultExpanded(models) {
  const set = new Set();
  for (const { root, model } of models) {
    for (const cat of model.children) set.add(`${root}:${cat.path}`);
  }
  return set;
}

/** Localized display title for a data root. */
function rootTitle(intl, root) {
  return intl.formatMessage(root === "lists" ? msgs.lists : msgs.blocks);
}

/**
 * The Manage workspace.
 * @param {object} props
 * @param {object} props.settings Current settings (reads `includeAdult`).
 * @param {boolean} props.available Whether the local-mode backend is present.
 * @param {boolean} props.active Whether this tab is currently shown.
 * @returns {JSX.Element}
 */
export default function Manage({ settings, available, active }) {
  const intl = useIntl();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(null); // { kind: "entry"|"folder", ...data }
  const [refreshing, setRefreshing] = useState(false);
  const [manifest, setManifest] = useState(null); // stable-branch file list (for ghost entries)

  async function loadTree(initialExpand = false) {
    setLoading(true);
    setError("");
    try {
      const [t, m] = await Promise.all([getTree(), getRemoteManifest()]);
      setTree(t);
      setManifest(m);
      if (initialExpand) {
        const models = ROOTS.map((root) => ({
          root,
          model: buildManageModel(t[root], root, { includeAdult: settings.includeAdult }),
        }));
        setExpanded(defaultExpanded(models));
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Load once when the tab first becomes active in local mode.
  useEffect(() => {
    if (active && available && !tree && !loading) loadTree(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, available]);

  // Refetch the tree when the catalog hot-applies (an edit elsewhere / a refresh).
  useEffect(() => subscribeCatalog(() => available && loadTree()), [available]);

  // External-edit auto-refresh: watch the data roots over SSE and reload on change (debounced). The
  // manual Refresh button is the fallback if the stream isn't available.
  useEffect(() => {
    if (!available) return undefined;
    let es;
    let t;
    try {
      es = new EventSource("/api/manage/watch");
      es.onmessage = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          refreshCatalog().catch(() => {});
          loadTree();
        }, 300);
      };
    } catch {
      /* no SSE — manual refresh still works */
    }
    return () => {
      if (es) es.close();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  const models = useMemo(() => {
    if (!tree) return [];
    return ROOTS.map((root) => {
      const title = rootTitle(intl, root);
      const full = buildManageModel(tree[root], root, { includeAdult: settings.includeAdult });
      // Inject "ghost" entries: files on the stable branch that are missing locally (restorable).
      if (manifest?.[root]) {
        const ghosts = computeGhosts(tree[root], manifest[root], root, {
          includeAdult: settings.includeAdult,
        });
        injectGhosts(full, ghosts);
      }
      const q = query.trim().toLowerCase();
      const model = q ? filterModel(full, q) || { ...full, children: [], entries: [] } : full;
      return { root, title, model };
    });
  }, [tree, manifest, settings.includeAdult, query, intl]);

  async function onRefresh() {
    setRefreshing(true);
    await refreshCatalog().catch(() => {});
    await loadTree();
    setRefreshing(false);
  }

  const toggle = (key) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Generators open in the block editor; lists/groups in the list editor (each loads its own file).
  function openEntry(entry) {
    setSelected({ type: "entry", ...entry });
  }

  // After an edit/rename: hot-apply (refreshCatalog notifies → the tree reloads) and, on a rename,
  // reselect the moved item so the editor reloads at its new path.
  async function handleChanged(next) {
    const ok = await refreshCatalog().catch(() => false);
    if (!ok) await loadTree();
    if (next && next.deleted) setSelected(null);
    else if (next && next.path) setSelected((s) => (s ? { ...s, ...next } : s));
  }

  const [addMenu, setAddMenu] = useState(null); // { root, folder } for the open add-menu, or null
  const [dragEntry, setDragEntry] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // `${root}:${folder}` currently hovered

  const cleanName = (raw) => (raw || "").trim().replace(/[^\w.-]/g, "-").replace(/^\.+/, "");

  // Create a new block/list file in a folder, then open it for editing.
  async function newFile(root, folder) {
    setAddMenu(null);
    const name = cleanName(
      window.prompt(intl.formatMessage(root === "lists" ? msgs.newFilePromptList : msgs.newFilePromptBlock)),
    );
    if (!name) return;
    const ext = root === "lists" ? "txt" : "dpl";
    const path = folder ? `${folder}/${name}` : name;
    const boiler = root === "lists" ? "" : `${name}\n===\n`;
    try {
      await fsOp("mkfile", { root, path: `${path}.${ext}`, text: boiler });
      await handleChanged();
      setSelected({
        type: "entry",
        root,
        path,
        ext,
        kind: root === "lists" ? "list" : "generator",
        label: name,
      });
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // Create a new subfolder.
  async function newFolder(root, folder) {
    setAddMenu(null);
    const name = cleanName(window.prompt(intl.formatMessage(msgs.newFolderPrompt)));
    if (!name) return;
    const path = folder ? `${folder}/${name}` : name;
    try {
      await fsOp("mkdir", { root, path });
      setExpanded((s) => new Set(s).add(`${root}:${folder}`));
      await handleChanged();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // Drag-and-drop move: relocate an entry's files (content + js sidecar + json sidecar) into a folder.
  async function moveEntryTo(e, root, destFolder) {
    const curFolder = e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "";
    if (e.root !== root || curFolder === destFolder || e.ghost) return;
    const target = destFolder ? `${destFolder}/${e.label}` : e.label;
    try {
      await fsOp("move", { root, path: `${e.path}.${e.ext}`, to: `${target}.${e.ext}` });
      for (const side of ["js", "json"]) {
        try {
          await fsOp("move", { root, path: `${e.path}.${side}`, to: `${target}.${side}` });
        } catch {
          /* no such sidecar */
        }
      }
      await handleChanged();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  // Delete an entry's files (content + sidecars) after confirming.
  async function deleteEntry(e) {
    if (
      !window.confirm(
        intl.formatMessage(msgs.deleteEntryConfirm, { label: e.label, root: e.root, path: e.path }),
      )
    )
      return;
    try {
      await fsOp("delete", { root: e.root, path: `${e.path}.${e.ext}` });
      for (const side of ["js", "json"]) {
        try {
          await fsOp("delete", { root: e.root, path: `${e.path}.${side}` });
        } catch {
          /* no sidecar */
        }
      }
      if (selected?.path === e.path) setSelected(null);
      await handleChanged();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  // Restore a ghost entry (a file deleted locally but present upstream) from the stable branch.
  async function restoreGhost(e) {
    try {
      await restoreDefault(e.root, `${e.path}.${e.ext}`);
      await handleChanged();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  // One entry pill. A normal entry has a hover Edit action (clicking the pill never inserts). A
  // "ghost" (deleted locally, still upstream) is faded and offers only Restore.
  const EntryPill = ({ e }) =>
    e.ghost ? (
      <span className={`mg-pill kind-${e.kind} is-ghost`} title={intl.formatMessage(msgs.ghostTitle, { path: e.path })}>
        <span className="mg-pill-label">{e.label}</span>
        <span className="mg-ghost-tag">{intl.formatMessage(msgs.ghostTag)}</span>
        <button
          className="mg-pill-act"
          title={intl.formatMessage(msgs.restoreTitle, { label: e.label })}
          aria-label={intl.formatMessage(msgs.restoreAria, { label: e.label })}
          onClick={() => restoreGhost(e)}
        >
          <RestoreIcon />
        </button>
      </span>
    ) : (
      <span
        className={`mg-pill kind-${e.kind}${selected?.path === e.path ? " on" : ""}`}
        title={e.path}
        draggable
        onDragStart={() => setDragEntry(e)}
        onDragEnd={() => setDragEntry(null)}
      >
        <span className="mg-pill-label">{e.label}</span>
        {e.nsfw && (
          <span className="mg-nsfw" title={intl.formatMessage(msgs.nsfw)}>
            {intl.formatMessage(msgs.nsfwTag)}
          </span>
        )}
        {e.hasJsSidecar && (
          <span className="mg-js" title={intl.formatMessage(msgs.jsTitle)}>
            {intl.formatMessage(msgs.jsTag)}
          </span>
        )}
        <button className="mg-pill-act" title={intl.formatMessage(msgs.editTitle, { label: e.label })} aria-label={intl.formatMessage(msgs.editTitle, { label: e.label })} onClick={() => openEntry(e)}>
          <EditIcon />
        </button>
        <button
          className="mg-pill-act mg-pill-del"
          title={intl.formatMessage(msgs.deleteTitle, { label: e.label })}
          aria-label={intl.formatMessage(msgs.deleteTitle, { label: e.label })}
          onClick={() => deleteEntry(e)}
        >
          <TrashIcon />
        </button>
      </span>
    );

  if (!available) {
    return (
      <div className="manage-locked">
        <h2>{intl.formatMessage(msgs.lockedTitle)}</h2>
        <p>{intl.formatMessage(msgs.lockedBody)}</p>
      </div>
    );
  }

  // Recursive folder renderer.
  const FolderNode = ({ node, root }) => {
    const key = `${root}:${node.path}`;
    const open = expanded.has(key);
    const cls = [
      "mg-folder",
      node.isCategory ? "is-category" : "is-subfolder",
      node.markers.length ? "is-special" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const isDrop = dropTarget === key && dragEntry && dragEntry.root === root;
    return (
      <div className={cls}>
        <div
          className={`mg-folder-head${isDrop ? " is-drop" : ""}`}
          onDragOver={(ev) => {
            if (dragEntry && dragEntry.root === root) {
              ev.preventDefault();
              setDropTarget(key);
            }
          }}
          onDragLeave={() => setDropTarget((d) => (d === key ? null : d))}
          onDrop={(ev) => {
            ev.preventDefault();
            const e = dragEntry;
            setDropTarget(null);
            setDragEntry(null);
            if (e) moveEntryTo(e, root, node.path);
          }}
        >
          <button className="mg-twirl" onClick={() => toggle(key)} aria-expanded={open}
            aria-label={intl.formatMessage(open ? msgs.collapse : msgs.expand)}>
            <Caret open={open} />
          </button>
          <span className="mg-folder-name" onClick={() => toggle(key)}>{node.name}</span>
          {!node.ghostFolder && (
            <button
              className="mg-gear"
              title={intl.formatMessage(msgs.folderSettings, { name: node.name })}
              aria-label={intl.formatMessage(msgs.settingsFor, { name: node.name })}
              onClick={() => setSelected({ type: "folder", ...node })}
            >
              <GearIcon />
            </button>
          )}
          {!node.ghostFolder && (
            <span className="mg-add-wrap">
              <button
                className="mg-add"
                title={intl.formatMessage(msgs.addTo, { name: node.name })}
                aria-label={intl.formatMessage(msgs.addTo, { name: node.name })}
                onClick={() => setAddMenu((m) => (m && m.folder === node.path && m.root === root ? null : { root, folder: node.path }))}
              >
                +
              </button>
              {addMenu && addMenu.root === root && addMenu.folder === node.path && (
                <span className="mg-add-menu" role="menu">
                  <button onClick={() => newFile(root, node.path)}>{intl.formatMessage(root === "lists" ? msgs.newList : msgs.newBlock)}</button>
                  <button onClick={() => newFolder(root, node.path)}>{intl.formatMessage(msgs.newSubfolder)}</button>
                </span>
              )}
            </span>
          )}
          {node.markers.map((m) => (
            <span key={m} className={`mg-badge mg-badge-${m}`} title={badgeTitle(intl, m)}>
              {intl.formatMessage(m === "force-prefix" ? msgs.badgePrefix : msgs.badgeGroup)}
            </span>
          ))}
          <span className="mg-count count-pill">{node.entryCount}</span>
        </div>
        {open && (
          <div className="mg-folder-body">
            {node.children.map((c) => (
              <FolderNode key={c.path} node={c} root={root} />
            ))}
            {node.entries.length > 0 && (
              <div className="mg-entries">
                {node.entries.map((e) => (
                  <EntryPill key={e.path} e={e} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="workspace manage">
      <aside className="sidebar mg-sidebar">
        <div className="panel-head">
          <h3 className="panel-title">{intl.formatMessage(msgs.panelTitle)}</h3>
          <div className="mg-head-actions">
            <input
              className="picker-filter"
              placeholder={intl.formatMessage(msgs.searchPh)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`mg-refresh${refreshing ? " spinning" : ""}`}
              onClick={onRefresh}
              title={intl.formatMessage(msgs.refreshTitle)}
              aria-label={intl.formatMessage(msgs.refreshAria)}
              disabled={refreshing}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {loading && !tree ? (
          <p className="empty">{intl.formatMessage(msgs.loadingCatalog)}</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="mg-tree">
            {models.map(({ root, title, model }) => (
              <div
                key={root}
                className={`mg-root${dropTarget === `${root}:` && dragEntry?.root === root ? " is-drop" : ""}`}
                onDragOver={(ev) => {
                  if (dragEntry && dragEntry.root === root) {
                    ev.preventDefault();
                    setDropTarget(`${root}:`);
                  }
                }}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const e = dragEntry;
                  setDropTarget(null);
                  setDragEntry(null);
                  if (e) moveEntryTo(e, root, "");
                }}
              >
                <div className="mg-root-title">
                  <span>{title}</span>
                  <span className="mg-add-wrap">
                    <button
                      className="mg-add"
                      title={intl.formatMessage(msgs.addTo, { name: title })}
                      aria-label={intl.formatMessage(msgs.addTo, { name: title })}
                      onClick={() => setAddMenu((m) => (m && m.root === root && m.folder === "" ? null : { root, folder: "" }))}
                    >
                      +
                    </button>
                    {addMenu && addMenu.root === root && addMenu.folder === "" && (
                      <span className="mg-add-menu" role="menu">
                        <button onClick={() => newFile(root, "")}>{intl.formatMessage(root === "lists" ? msgs.newList : msgs.newBlock)}</button>
                        <button onClick={() => newFolder(root, "")}>{intl.formatMessage(msgs.newFolder)}</button>
                      </span>
                    )}
                  </span>
                </div>
                {model.children.length === 0 && model.entries.length === 0 ? (
                  <p className="empty">{intl.formatMessage(msgs.nothingMatches)}</p>
                ) : (
                  <>
                    {model.children.map((c) => (
                      <FolderNode key={c.path} node={c} root={root} />
                    ))}
                    {model.entries.map((e) => (
                      <EntryPill key={e.path} e={e} />
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>

      <div className="main-col mg-main">
        {selected?.type === "folder" ? (
          <ManageFolderEditor node={selected} onChanged={handleChanged} />
        ) : selected?.type === "entry" && selected.kind === "generator" ? (
          <ManageBlockEditor entry={selected} settings={settings} onChanged={handleChanged} />
        ) : selected?.type === "entry" && (selected.kind === "list" || selected.kind === "group") ? (
          <ManageListEditor entry={selected} settings={settings} onChanged={handleChanged} />
        ) : (
          <ManageDetail selected={selected} />
        )}
      </div>
    </div>
  );
}

function badgeTitle(intl, m) {
  if (m === "force-prefix") return intl.formatMessage(msgs.badgeForcePrefixTitle);
  if (m === "group") return intl.formatMessage(msgs.badgeGroupTitle);
  return m;
}

