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
import { getTree, getRemoteManifest, restoreDefault, fsOp } from "../lib/manageApi.js";
import { refreshCatalog, subscribeCatalog } from "../lib/promptEngine.js";
import { buildManageModel, filterModel, computeGhosts, injectGhosts } from "../lib/manageTree.js";
import ManageBlockEditor from "./ManageBlockEditor.jsx";
import ManageFolderEditor from "./ManageFolderEditor.jsx";
import ManageListEditor from "./ManageListEditor.jsx";

const ROOTS = [
  ["dynamic-prompts", "Blocks"],
  ["lists", "Lists"],
];

const ico = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const Caret = ({ open }) => (
  <svg {...ico} width={13} height={13} style={{ transform: open ? "rotate(90deg)" : "none" }} aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
const GearIcon = () => (
  <svg {...ico} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const EditIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
);
const RefreshIcon = () => (
  <svg {...ico} aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const RestoreIcon = () => (
  <svg {...ico} aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <polyline points="21 3 21 8 16 8" />
  </svg>
);
const TrashIcon = () => (
  <svg {...ico} aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/** Collect the paths of every category (depth-1) folder, to expand them by default. */
function defaultExpanded(models) {
  const set = new Set();
  for (const { root, model } of models) {
    for (const cat of model.children) set.add(`${root}:${cat.path}`);
  }
  return set;
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
        const models = ROOTS.map(([root]) => ({
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
    return ROOTS.map(([root, title]) => {
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
  }, [tree, manifest, settings.includeAdult, query]);

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
    const name = cleanName(window.prompt(`New ${root === "lists" ? "list" : "block"} name:`));
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
    const name = cleanName(window.prompt("New subfolder name:"));
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
    if (!window.confirm(`Delete ${e.label} (${e.root}/${e.path})? This removes the file from disk.`)) return;
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
      <span className={`mg-pill kind-${e.kind} is-ghost`} title={`${e.path} — deleted locally; restore from the repo`}>
        <span className="mg-pill-label">{e.label}</span>
        <span className="mg-ghost-tag">ghost</span>
        <button
          className="mg-pill-act"
          title={`Restore ${e.label} from the repo`}
          aria-label={`Restore ${e.label}`}
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
          <span className="mg-nsfw" title="NSFW">
            18+
          </span>
        )}
        {e.hasJsSidecar && (
          <span className="mg-js" title="Has a JS sidecar">
            JS
          </span>
        )}
        <button className="mg-pill-act" title={`Edit ${e.label}`} aria-label={`Edit ${e.label}`} onClick={() => openEntry(e)}>
          <EditIcon />
        </button>
        <button
          className="mg-pill-act mg-pill-del"
          title={`Delete ${e.label}`}
          aria-label={`Delete ${e.label}`}
          onClick={() => deleteEntry(e)}
        >
          <TrashIcon />
        </button>
      </span>
    );

  if (!available) {
    return (
      <div className="manage-locked">
        <h2>Manage is a local-mode feature</h2>
        <p>
          The content manager edits the prompt files on your disk, so it needs the local app (the dev
          server or a local build). It isn’t available in the online version.
        </p>
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
            aria-label={open ? "Collapse" : "Expand"}>
            <Caret open={open} />
          </button>
          <span className="mg-folder-name" onClick={() => toggle(key)}>{node.name}</span>
          {!node.ghostFolder && (
            <button
              className="mg-gear"
              title={`Folder settings — ${node.name}`}
              aria-label={`Settings for ${node.name}`}
              onClick={() => setSelected({ type: "folder", ...node })}
            >
              <GearIcon />
            </button>
          )}
          {!node.ghostFolder && (
            <span className="mg-add-wrap">
              <button
                className="mg-add"
                title={`Add to ${node.name}`}
                aria-label={`Add to ${node.name}`}
                onClick={() => setAddMenu((m) => (m && m.folder === node.path && m.root === root ? null : { root, folder: node.path }))}
              >
                +
              </button>
              {addMenu && addMenu.root === root && addMenu.folder === node.path && (
                <span className="mg-add-menu" role="menu">
                  <button onClick={() => newFile(root, node.path)}>New {root === "lists" ? "list" : "block"}</button>
                  <button onClick={() => newFolder(root, node.path)}>New subfolder</button>
                </span>
              )}
            </span>
          )}
          {node.markers.map((m) => (
            <span key={m} className={`mg-badge mg-badge-${m}`} title={badgeTitle(m)}>
              {m === "force-prefix" ? "prefix" : "group"}
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
          <h3 className="panel-title">Manage</h3>
          <div className="mg-head-actions">
            <input
              className="picker-filter"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`mg-refresh${refreshing ? " spinning" : ""}`}
              onClick={onRefresh}
              title="Refresh catalog (re-read from disk)"
              aria-label="Refresh catalog"
              disabled={refreshing}
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {loading && !tree ? (
          <p className="empty">Loading the catalog…</p>
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
                      title={`Add to ${title}`}
                      aria-label={`Add to ${title}`}
                      onClick={() => setAddMenu((m) => (m && m.root === root && m.folder === "" ? null : { root, folder: "" }))}
                    >
                      +
                    </button>
                    {addMenu && addMenu.root === root && addMenu.folder === "" && (
                      <span className="mg-add-menu" role="menu">
                        <button onClick={() => newFile(root, "")}>New {root === "lists" ? "list" : "block"}</button>
                        <button onClick={() => newFolder(root, "")}>New folder</button>
                      </span>
                    )}
                  </span>
                </div>
                {model.children.length === 0 && model.entries.length === 0 ? (
                  <p className="empty">Nothing matches.</p>
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

function badgeTitle(m) {
  if (m === "force-prefix") return "Force-prefix folder — its path shows in the token";
  if (m === "group") return "Group folder — referencing it picks one random member";
  return m;
}

/**
 * The right-pane detail/preview for the current selection. The real editors land in the next phases;
 * for now this shows what was selected (path, kind, attributes) and a read-only content preview.
 * @param {object} props
 * @param {object|null} props.selected The selected entry or folder.
 * @returns {JSX.Element}
 */
function ManageDetail({ selected }) {
  if (!selected) {
    return (
      <section className="card mg-detail mg-detail-empty">
        <p>Select a block, list, or folder on the left to inspect it. Editing arrives next.</p>
      </section>
    );
  }
  if (selected.kind === "folder") {
    return (
      <section className="card mg-detail">
        <h2 className="mg-detail-title">{selected.name || "(root)"}</h2>
        <dl className="mg-meta">
          <dt>Path</dt>
          <dd>
            <code>{selected.root}/{selected.path}</code>
          </dd>
          <dt>Type</dt>
          <dd>{selected.isCategory ? "Category (top-level)" : "Subfolder"}</dd>
          <dt>Attributes</dt>
          <dd>{selected.markers.length ? selected.markers.join(", ") : "none"}</dd>
          <dt>Entries</dt>
          <dd>{selected.entryCount}</dd>
        </dl>
        <p className="mg-soon">The folder settings editor (rename, priority, markers) arrives next.</p>
      </section>
    );
  }
  return (
    <section className="card mg-detail">
      <h2 className="mg-detail-title">
        {selected.label} <span className={`mg-kind kind-${selected.kind}`}>{selected.kind}</span>
      </h2>
      <dl className="mg-meta">
        <dt>Path</dt>
        <dd>
          <code>{selected.root}/{selected.path}.{selected.ext}</code>
        </dd>
        {selected.nsfw && (
          <>
            <dt>Gating</dt>
            <dd>NSFW</dd>
          </>
        )}
        {selected.hasJsSidecar && (
          <>
            <dt>Sidecar</dt>
            <dd>has a JS sidecar</dd>
          </>
        )}
      </dl>
      <div className="mg-preview">
        {selected.loading ? (
          <p className="empty">Loading…</p>
        ) : selected.error ? (
          <p className="error">{selected.error}</p>
        ) : (
          <pre className="mg-preview-pre">{previewText(selected.text)}</pre>
        )}
      </div>
      <p className="mg-soon">A full editor (with save + hot-apply) arrives next.</p>
    </section>
  );
}

// Cap the read-only preview so an enormous list stays snappy here; the real editor handles full size.
function previewText(text) {
  if (text == null) return "";
  const lines = text.split("\n");
  if (lines.length <= 500) return text;
  return `${lines.slice(0, 500).join("\n")}\n\n… ${lines.length - 500} more lines (full editor coming).`;
}
