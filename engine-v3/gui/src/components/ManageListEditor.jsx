/**
 * The list (and `.group`) editor for the Manage tab. Two modes:
 *  - **Entries** (default): a searchable, **virtualized** row list (only the visible window is in the
 *    DOM) with quick add / inline-edit / delete — seamless even for the 20k–27k-line lists, with no
 *    size warnings.
 *  - **Raw**: the whole file in a plain-text CodeMirror (also viewport-rendered, so it stays smooth).
 *
 * The file is fetched once; entry edits mutate an in-memory line array and only the visible rows
 * render, so nothing re-serializes the whole file per keystroke. Saving writes the file and
 * hot-applies (`onChanged`). Also supports rename, a description sidecar, and restore-to-default.
 * @module gui/components/ManageListEditor
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { msgs } from "../lib/manage/listEditorMessages.js";
import { readFile, writeFile, saveSidecar, fsOp, restoreDefault } from "../lib/manageApi.js";
import { rewritePrompt } from "../lib/rewrite.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { getProvider } from "../lib/providers/index.js";
import CodeEditor from "./CodeEditor.jsx";
import {
  parseAiCandidates,
  mergeNew,
  dedupeLines,
  sortLines as sortEntries,
} from "../lib/manage/listEditorOps.js";

const AI_SAMPLE = 25; // entries sampled and new entries requested per AI expand round

const ROW_H = 30; // px per entry row (fixed, for windowing)
const OVERSCAN = 8;

/**
 * @param {object} props
 * @param {object} props.entry The selected `{ root, path, ext, label, kind }` (kind: list | group).
 * @param {object} [props.settings] App settings — used to reach the rewrite (text) provider + key
 *   for AI Expand.
 * @param {Function} props.onChanged Hot-apply + refresh after a write; gets the new path on rename.
 * @returns {JSX.Element}
 */
export default function ManageListEditor({ entry, settings = {}, onChanged }) {
  const intl = useIntl();
  const base = entry.path;
  const folder = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [mode, setMode] = useState("entries");
  const [lines, setLines] = useState([]); // entry source of truth
  const [rawText, setRawText] = useState(""); // only authoritative while mode === "raw"
  const trailingNL = useRef(true);
  const [name, setName] = useState(entry.label);
  const [description, setDescription] = useState("");
  const [dirty, setDirty] = useState(false);

  const [query, setQuery] = useState("");
  const [editIdx, setEditIdx] = useState(-1);
  const [editVal, setEditVal] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(480);
  const [expanding, setExpanding] = useState(false);
  const scrollerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setStatus("");
    setDirty(false);
    setMode("entries");
    setQuery("");
    setName(entry.label);
    (async () => {
      try {
        const text = await readFile(entry.root, `${base}.${entry.ext}`);
        const arr = text.split("\n");
        trailingNL.current = arr.length > 0 && arr[arr.length - 1] === "";
        if (trailingNL.current) arr.pop();
        let meta = {};
        try {
          meta = JSON.parse(await readFile(entry.root, `${base}.json`));
        } catch {
          meta = {};
        }
        if (!alive) return;
        setLines(arr);
        setDescription(meta.description || "");
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.root, entry.path]);

  // Keep the windowing height in sync with the scroller.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, [mode, loading]);

  const serialize = (arr) => arr.join("\n") + (trailingNL.current ? "\n" : "");

  function switchMode(next) {
    if (next === mode) return;
    if (next === "raw") {
      setRawText(serialize(lines));
    } else {
      // raw → entries: re-parse
      const arr = rawText.split("\n");
      trailingNL.current = arr.length > 0 && arr[arr.length - 1] === "";
      if (trailingNL.current) arr.pop();
      setLines(arr);
    }
    setMode(next);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return null; // null = show all (by index)
    const q = query.toLowerCase();
    const idx = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].toLowerCase().includes(q)) idx.push(i);
    return idx;
  }, [query, lines]);

  const visibleCount = filtered ? filtered.length : lines.length;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endRow = Math.min(visibleCount, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  function setLine(i, val) {
    setLines((a) => {
      const next = a.slice();
      next[i] = val;
      return next;
    });
    setDirty(true);
  }
  function deleteLine(i) {
    setLines((a) => a.filter((_, k) => k !== i));
    setDirty(true);
  }
  function addLine() {
    setLines((a) => ["", ...a]);
    setDirty(true);
    setEditIdx(0);
    setEditVal("");
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }
  function commitEdit() {
    if (editIdx >= 0) setLine(editIdx, editVal);
    setEditIdx(-1);
  }

  // Drop duplicate entries (case-insensitive, trimmed; keeps the first occurrence and the original
  // order). Empty lines collapse to one. Reports how many were removed.
  function dedupe() {
    setStatus("");
    setError("");
    setLines((a) => {
      const { lines: out, removed } = dedupeLines(a);
      if (removed > 0) {
        setDirty(true);
        setStatus(intl.formatMessage(msgs.removedDupes, { count: removed }));
        return out;
      }
      setStatus(intl.formatMessage(msgs.noDupes));
      return a;
    });
    setEditIdx(-1);
  }

  // Sort entries alphabetically (case-insensitive, locale-aware).
  function sortLines() {
    setStatus("");
    setError("");
    setLines((a) => sortEntries(a));
    setDirty(true);
    setStatus(intl.formatMessage(msgs.sortedAZ));
    setEditIdx(-1);
  }

  // AI Expand: send a random sample of existing entries to the text (rewrite) provider and ask for
  // 25 fresh ones in the same vein, then merge in the unique ones. There's no way to guarantee the
  // model avoids entries it can't see, so the result is deduped on the way in and the net-new count
  // is reported. Added rows land at the top, marked dirty, for the user to review before saving.
  async function aiExpand() {
    const providerId = settings.rewriteProvider;
    if (!providerId || providerId === "none") {
      setStatus("");
      setError(intl.formatMessage(msgs.pickProvider));
      return;
    }
    const key = effectiveKey(providerId, settings);
    const provider = getProvider(providerId);
    if (provider?.needsKey && !key) {
      setStatus("");
      setError(intl.formatMessage(msgs.noKey, { provider: provider?.label || providerId }));
      return;
    }

    const pool = lines.map((l) => l.trim()).filter(Boolean);
    if (!pool.length) {
      setStatus("");
      setError(intl.formatMessage(msgs.addEntriesFirst));
      return;
    }

    // Random sample without lodash (Fisher–Yates on a copy).
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const sample = shuffled.slice(0, AI_SAMPLE);

    setError("");
    setStatus("");
    setExpanding(true);
    try {
      const out = await rewritePrompt({ providerId, prompt: sample.join("\n"), key, mode: "expand" });
      const candidates = parseAiCandidates(out);
      const added = mergeNew(pool, candidates);

      if (!added.length) {
        setStatus(intl.formatMessage(msgs.onlyDupes));
        return;
      }
      setLines((a) => [...added, ...a]);
      setDirty(true);
      setEditIdx(-1);
      const dropped = candidates.length - added.length;
      setStatus(
        intl.formatMessage(msgs.addedStatus, {
          count: added.length,
          dropped: dropped ? intl.formatMessage(msgs.droppedClause, { count: dropped }) : "",
        }),
      );
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    } catch (e) {
      setError(intl.formatMessage(msgs.expandFailed, { error: e.message || String(e) }));
    } finally {
      setExpanding(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const text = mode === "raw" ? rawText : serialize(lines);
      await writeFile(entry.root, `${base}.${entry.ext}`, text);
      await saveSidecar(entry.root, base, { description: description.trim() || null });
      setDirty(false);
      setStatus(intl.formatMessage(msgs.saved));
      await onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function rename() {
    const clean = name.trim().replace(/\.(txt|group|json)$/i, "");
    if (!clean || clean === entry.label) return;
    const target = folder ? `${folder}/${clean}` : clean;
    setSaving(true);
    setError("");
    try {
      await fsOp("move", { root: entry.root, path: `${base}.${entry.ext}`, to: `${target}.${entry.ext}` });
      try {
        await fsOp("move", { root: entry.root, path: `${base}.json`, to: `${target}.json` });
      } catch {
        /* no sidecar */
      }
      setStatus(intl.formatMessage(msgs.renamed));
      await onChanged?.({ ...entry, path: target, label: clean });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (
      !confirm(intl.formatMessage(msgs.restoreConfirm, { name: `${entry.label}.${entry.ext}` }))
    )
      return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await restoreDefault(entry.root, `${base}.${entry.ext}`);
      setStatus(intl.formatMessage(msgs.restored));
      setDirty(false);
      await onChanged?.({ ...entry }); // reselect → reload
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <section className="card mg-detail">
        <p className="empty">{intl.formatMessage(msgs.loading)}</p>
      </section>
    );

  const rows = [];
  for (let r = startRow; r < endRow; r++) {
    const i = filtered ? filtered[r] : r;
    rows.push(
      <div className="mg-row" style={{ top: r * ROW_H, height: ROW_H }} key={i}>
        {editIdx === i ? (
          <input
            className="mg-row-input"
            autoFocus
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditIdx(-1);
            }}
          />
        ) : (
          <span
            className="mg-row-text"
            onClick={() => {
              setEditIdx(i);
              setEditVal(lines[i]);
            }}
            title={intl.formatMessage(msgs.clickToEdit)}
          >
            {lines[i] === "" ? <em className="mg-row-empty">{intl.formatMessage(msgs.empty)}</em> : lines[i]}
          </span>
        )}
        <button className="mg-row-del" onClick={() => deleteLine(i)} aria-label={intl.formatMessage(msgs.deleteEntryAria)} title={intl.formatMessage(msgs.deleteTitle)}>
          ×
        </button>
      </div>,
    );
  }

  return (
    <section className="card mg-detail mg-editor">
      <div className="mg-editor-head">
        <input className="mg-name-input" value={name} onChange={(e) => setName(e.target.value)} aria-label={intl.formatMessage(msgs.listName)} />
        <span className={`mg-kind kind-${entry.kind}`}>{entry.kind}</span>
        <button className="link-btn" onClick={rename} disabled={saving || name.trim() === entry.label}>
          {intl.formatMessage(msgs.rename)}
        </button>
        <div className="grow" />
        <div className="mg-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "entries"} className={`mg-tab${mode === "entries" ? " on" : ""}`} onClick={() => switchMode("entries")}>
            {intl.formatMessage(msgs.tabEntries)}
          </button>
          <button role="tab" aria-selected={mode === "raw"} className={`mg-tab${mode === "raw" ? " on" : ""}`} onClick={() => switchMode("raw")}>
            {intl.formatMessage(msgs.tabRaw)}
          </button>
        </div>
        <button className="primary" onClick={save} disabled={saving || !dirty}>
          {intl.formatMessage(saving ? msgs.saving : msgs.save)}
        </button>
      </div>

      <label className="mg-field">
        <span>{intl.formatMessage(msgs.description)}</span>
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDirty(true);
          }}
          placeholder={intl.formatMessage(msgs.descriptionPh)}
        />
      </label>

      {mode === "entries" ? (
        <>
          <div className="mg-list-tools">
            <input
              className="picker-filter"
              placeholder={intl.formatMessage(msgs.searchPh, { count: lines.length })}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="link-btn" onClick={addLine}>
              {intl.formatMessage(msgs.addEntry)}
            </button>
            <button className="link-btn" onClick={sortLines} disabled={saving || lines.length < 2} title={intl.formatMessage(msgs.sortTitle)}>
              {intl.formatMessage(msgs.sort)}
            </button>
            <button className="link-btn" onClick={dedupe} disabled={saving || lines.length < 2} title={intl.formatMessage(msgs.dedupeTitle)}>
              {intl.formatMessage(msgs.dedupe)}
            </button>
            <button
              className="link-btn"
              onClick={aiExpand}
              disabled={saving || expanding || lines.length === 0}
              title={intl.formatMessage(msgs.aiExpandTitle)}
            >
              {intl.formatMessage(expanding ? msgs.expanding : msgs.aiExpand)}
            </button>
            <span className="mg-count-note">
              {filtered
                ? intl.formatMessage(msgs.countMatch, { count: filtered.length })
                : intl.formatMessage(msgs.countEntries, { count: lines.length })}
            </span>
          </div>
          <div
            className="mg-rows"
            ref={scrollerRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div className="mg-rows-inner" style={{ height: visibleCount * ROW_H }}>
              {rows}
            </div>
          </div>
        </>
      ) : (
        <div className="mg-editor-body">
          <CodeEditor
            value={rawText}
            onChange={(v) => {
              setRawText(v);
              setDirty(true);
            }}
            lineNumbers
            className="mg-cm"
            ariaLabel={intl.formatMessage(msgs.rawAria)}
          />
        </div>
      )}

      <div className="mg-editor-foot">
        <button className="link-btn" onClick={restore} disabled={saving} title={intl.formatMessage(msgs.restoreTitle)}>
          {intl.formatMessage(msgs.restoreDefault)}
        </button>
        {status && <span className="mg-ok">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
