/**
 * @file The Manage tab's data + CRUD lifecycle as a hook: it owns the on-disk tree and stable-branch
 * manifest, the catalog/SSE refresh wiring, the expand/select/search/drag state, the built+filtered
 * tree `models`, and every file operation (new file/folder, move, delete, restore-ghost). The Manage
 * component is left as pure rendering over what this returns. Covered by gui/tests/lib/useManageTree.test.jsx.
 */
import { useEffect, useMemo, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { getTree, getRemoteManifest, restoreDefault, fsOp } from "../manageApi.js";
import { refreshCatalog, subscribeCatalog } from "../promptEngine.js";
import { buildManageModel, filterModel, computeGhosts, injectGhosts, isDpRoot } from "../manageTree.js";
import { dialog } from "../dialog.js";

// Data-root keys are fixed; their display titles are localized via `msgs` below. The user-overlay
// roots (user/lists, user/blocks) come FIRST so "your content" groups at the top of the tree.
const ROOTS = ["user-blocks", "user-lists", "blocks", "lists"];
// The user-overlay roots — no upstream default (no ghost pills / restore), grouped as "your content".
export const USER_ROOTS = new Set(["user-blocks", "user-lists"]);

const msgs = defineMessages({
  blocks: { id: "manage.blocks", defaultMessage: "Blocks" },
  lists: { id: "manage.lists", defaultMessage: "Lists" },
  userBlocks: { id: "manage.userBlocks", defaultMessage: "Your blocks" },
  userLists: { id: "manage.userLists", defaultMessage: "Your lists" },
  newFilePromptList: { id: "manage.newFilePromptList", defaultMessage: "New list name:" },
  newFilePromptBlock: { id: "manage.newFilePromptBlock", defaultMessage: "New block name:" },
  newFolderPrompt: { id: "manage.newFolderPrompt", defaultMessage: "New subfolder name:" },
  deleteEntryConfirm: {
    id: "manage.deleteEntryConfirm",
    defaultMessage: "Delete {label} ({root}/{path})? This removes the file from disk.",
  },
});

/** An empty raw tree node, used when a root is absent from the backend's response (e.g. an older
 *  backend that predates the user overlay, or a not-yet-created user/ folder). */
const EMPTY_TREE = { name: "", dirs: [], files: [] };

/** Collect the paths of every category (depth-1) folder, to expand them by default. */
export function defaultExpanded(models) {
  const set = new Set();
  for (const { root, model } of models) {
    for (const cat of model.children) set.add(`${root}:${cat.path}`);
  }
  return set;
}

/** Localized display title for a data root. */
function rootTitle(intl, root) {
  const title = {
    lists: msgs.lists,
    "blocks": msgs.blocks,
    "user-lists": msgs.userLists,
    "user-blocks": msgs.userBlocks,
  }[root];
  return intl.formatMessage(title || msgs.blocks);
}

/**
 * The Manage tab's data + CRUD lifecycle.
 * @param {object} args
 * @param {object} args.settings Current settings (reads `includeAdult`).
 * @param {boolean} args.available Whether the local-mode backend is present.
 * @param {boolean} args.active Whether the Manage tab is currently shown.
 * @returns {object} Tree state, derived `models`, and the file-operation handlers.
 */
export function useManageTree({ settings, available, active }) {
  const intl = useIntl();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(null); // { kind: "entry"|"folder", ...data }
  const [refreshing, setRefreshing] = useState(false);
  const [manifest, setManifest] = useState(null); // stable-branch file list (for ghost entries)
  const [addMenu, setAddMenu] = useState(null); // { root, folder } for the open add-menu, or null
  const [dragEntry, setDragEntry] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // `${root}:${folder}` currently hovered

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
          model: buildManageModel(t[root] || EMPTY_TREE, root, { includeAdult: settings.includeAdult }),
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

  // Refetch the tree when the catalog hot-applies — an edit here, OR an external file change picked
  // up by the app-level file-watch (App.jsx), which calls refreshCatalog() and so notifies us here.
  // The app owns the single SSE stream now, so Manage doesn't open its own; the manual Refresh
  // button remains the fallback.
  useEffect(() => subscribeCatalog(() => available && loadTree()), [available]);

  const models = useMemo(() => {
    if (!tree) return [];
    return ROOTS.map((root) => {
      const title = rootTitle(intl, root);
      const full = buildManageModel(tree[root] || EMPTY_TREE, root, { includeAdult: settings.includeAdult });
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

  const cleanName = (raw) => (raw || "").trim().replace(/[^\w.-]/g, "-").replace(/^\.+/, "");

  // Create a new block/list file in a folder, then open it for editing.
  async function newFile(root, folder) {
    setAddMenu(null);
    const isBlock = isDpRoot(root);
    const name = cleanName(
      await dialog.prompt({
        message: intl.formatMessage(isBlock ? msgs.newFilePromptBlock : msgs.newFilePromptList),
      }),
    );
    if (!name) return;
    const ext = isBlock ? "dpl" : "txt";
    const path = folder ? `${folder}/${name}` : name;
    const boiler = isBlock ? `${name}\n===\n` : "";
    try {
      await fsOp("mkfile", { root, path: `${path}.${ext}`, text: boiler });
      await handleChanged();
      setSelected({
        type: "entry",
        root,
        path,
        ext,
        kind: isBlock ? "generator" : "list",
        label: name,
      });
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  // Create a new subfolder.
  async function newFolder(root, folder) {
    setAddMenu(null);
    const name = cleanName(await dialog.prompt({ message: intl.formatMessage(msgs.newFolderPrompt) }));
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
      !(await dialog.confirm({
        message: intl.formatMessage(msgs.deleteEntryConfirm, {
          label: e.label,
          root: e.root,
          path: e.path,
        }),
        destructive: true,
      }))
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

  return {
    tree,
    loading,
    error,
    query,
    setQuery,
    expanded,
    toggle,
    selected,
    setSelected,
    refreshing,
    manifest,
    models,
    addMenu,
    setAddMenu,
    dragEntry,
    setDragEntry,
    dropTarget,
    setDropTarget,
    loadTree,
    onRefresh,
    openEntry,
    handleChanged,
    newFile,
    newFolder,
    moveEntryTo,
    deleteEntry,
    restoreGhost,
  };
}
