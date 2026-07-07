/**
 * The block (generator) editor for the Manage tab. Edits a `.dpl` generator's contents, name, and
 * description, with NSFW gating, plus full JS-sidecar support: if a `.js` sidecar exists it offers a
 * DPL ⇄ JS tab switch; if not, a one-click "Create JS sidecar" scaffolds one from boilerplate. Saving
 * writes the files and hot-applies (`onChanged` refreshes the catalog) — except that an edited JS
 * *module body* only takes effect on reload (running fetched JS would need eval), which the JS tab
 * flags. The `.dpl` and everything else apply live.
 * @module gui/components/ManageBlockEditor
 */
import { useEffect, useRef, useState } from "react";
import { useIntl, defineMessages } from "react-intl";
import { javascript } from "@codemirror/lang-javascript";
import { readFile, writeFile, saveSidecar, fsOp } from "../lib/manageApi.js";
import { hasNsfwToken } from "../../../../engine/gatedLists.js";
import { rewritePrompt } from "../lib/rewrite.js";
import { effectiveKey } from "../lib/sessionKeys.js";
import { getProvider } from "../lib/providers/index.js";
import { cleanDplOutput, buildCustomPrompt, DPL_CREATE_MODE, DPL_CUSTOM_MODE } from "../lib/dpl/dplRefine.js";
import { m as rf } from "../lib/dpl/dplRefineMessages.js";
import { validateDpl } from "../lib/dpl/validateDpl.js";
import DplEditor from "./DplEditor.jsx";
import DplInsertBar from "./DplInsertBar.jsx";
import DplRefineBar from "./DplRefineBar.jsx";
import DplAskCorner from "./DplAskCorner.jsx";
import DplStatus from "./DplStatus.jsx";
import CodeEditor from "./CodeEditor.jsx";

const JS_BOILERPLATE = `/**
 * JS sidecar for this generator. Return a string to inject (or "" to contribute nothing).
 * The .dpl calls it via \`script:\`, \`{js:}\`, or \`insert js:\`.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return "";
}

// export const suggestion_exclude = true; // keep this generator out of random suggestions
`;

const msgs = defineMessages({
  genName: { id: "blockEd.genName", defaultMessage: "Generator name" },
  block: { id: "blockEd.block", defaultMessage: "block" },
  rename: { id: "blockEd.rename", defaultMessage: "Rename" },
  saving: { id: "blockEd.saving", defaultMessage: "Saving…" },
  save: { id: "blockEd.save", defaultMessage: "Save" },
  savedJs: {
    id: "blockEd.savedJs",
    defaultMessage: "Saved — reload the app to run the changed JS.",
  },
  saved: { id: "blockEd.saved", defaultMessage: "Saved." },
  renamed: { id: "blockEd.renamed", defaultMessage: "Renamed." },
  description: { id: "blockEd.description", defaultMessage: "Description" },
  descriptionPh: { id: "blockEd.descriptionPh", defaultMessage: "Editor tooltip for this block" },
  nsfwFromNameTitle: {
    id: "blockEd.nsfwFromNameTitle",
    defaultMessage: "This name contains an nsfw token, so it is always NSFW.",
  },
  nsfwDisabledTitle: {
    id: "blockEd.nsfwDisabledTitle",
    defaultMessage: "NSFW option only available in NSFW mode.",
  },
  nsfwMarkTitle: {
    id: "blockEd.nsfwMarkTitle",
    defaultMessage: "Mark this block as NSFW (gated behind adult mode).",
  },
  nsfwLabel: { id: "blockEd.nsfwLabel", defaultMessage: "NSFW" },
  nsfwLabelFromName: { id: "blockEd.nsfwLabelFromName", defaultMessage: "NSFW (from name)" },
  tabDpl: { id: "blockEd.tabDpl", defaultMessage: "DPL" },
  tabJs: { id: "blockEd.tabJs", defaultMessage: "JS sidecar" },
  ariaDpl: { id: "blockEd.ariaDpl", defaultMessage: "Generator DPL" },
  ariaJs: { id: "blockEd.ariaJs", defaultMessage: "Generator JS sidecar" },
  createJs: { id: "blockEd.createJs", defaultMessage: "+ Create JS sidecar" },
  jsNote: {
    id: "blockEd.jsNote",
    defaultMessage: "JS runs on reload — DPL and the rest hot-apply.",
  },
  loading: { id: "blockEd.loading", defaultMessage: "Loading…" },
});

/**
 * @param {object} props
 * @param {object} props.entry The selected generator entry `{ root, path, ext, label, hasJsSidecar }`.
 * @param {object} props.settings App settings (DPL example expansion + `includeAdult` gating).
 * @param {Function} props.onChanged Called after a save/rename to hot-apply + refresh the tree.
 *   Receives the new logical path on a rename.
 * @returns {JSX.Element}
 */
export default function ManageBlockEditor({ entry, settings, onChanged }) {
  const intl = useIntl();
  const base = entry.path; // logical key, no extension
  const folder = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";
  const nameNsfw = hasNsfwToken(base);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const [dplText, setDplText] = useState(entry.ext === "js" ? null : "");
  const [jsText, setJsText] = useState(null); // null = no sidecar
  const [tab, setTab] = useState(entry.ext === "js" ? "js" : "dpl");
  const [name, setName] = useState(entry.label);
  const [description, setDescription] = useState("");
  const [nsfwFlag, setNsfwFlag] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refineBusy, setRefineBusy] = useState(""); // active DPL-refine mode, or "" when idle
  const [canUndo, setCanUndo] = useState(false); // a refine can be reverted to its snapshot
  const preRefine = useRef(null); // the DPL text captured just before the last refine
  const jsTouched = useRef(false);
  const dplEditorRef = useRef(null);

  // (Re)load whenever the selected generator changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setStatus("");
    setDirty(false);
    setRefineBusy("");
    setCanUndo(false);
    preRefine.current = null;
    jsTouched.current = false;
    setName(entry.label);
    setTab(entry.ext === "js" ? "js" : "dpl");
    (async () => {
      try {
        const dpl = entry.ext === "js" ? null : await readFile(entry.root, `${base}.dpl`);
        let js = null;
        if (entry.hasJsSidecar || entry.ext === "js") {
          try {
            js = await readFile(entry.root, `${base}.js`);
          } catch {
            js = null;
          }
        }
        let meta = {};
        try {
          meta = JSON.parse(await readFile(entry.root, `${base}.json`));
        } catch {
          meta = {};
        }
        if (!alive) return;
        setDplText(dpl);
        setJsText(js);
        setDescription(meta.description || "");
        setNsfwFlag(meta.nsfw === true || nameNsfw);
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

  const includeAdult = settings.includeAdult === true;

  function createJsSidecar() {
    setJsText(JS_BOILERPLATE);
    jsTouched.current = true;
    setTab("js");
    setDirty(true);
  }

  // Resolve the text (rewrite) provider + key for a DPL refine, mirroring the list editor's AI Expand.
  // Sets a friendly error and returns null when no provider is chosen or its key is missing.
  function resolveRewrite() {
    const providerId = settings.rewriteProvider;
    if (!providerId || providerId === "none") {
      setStatus("");
      setError(intl.formatMessage(rf.pickProvider));
      return null;
    }
    const key = effectiveKey(providerId, settings);
    const provider = getProvider(providerId);
    if (provider?.needsKey && !key) {
      setStatus("");
      setError(intl.formatMessage(rf.noKey, { provider: provider?.label || providerId }));
      return null;
    }
    return { providerId, key };
  }

  // Run one DPL refine / create / custom-modify through the text provider. `prompt` is the current
  // template (refine), the typed description (create), or the instruction+template message (custom).
  // The result replaces the editor content — stashed first so it can be reverted — and is validated so
  // the status can flag any issues to review. Not saved until Save. `kind` picks the status wording.
  async function runDpl(mode, prompt, { label, kind = "refine" } = {}) {
    if (!(prompt || "").trim()) {
      setStatus("");
      const needMsg = kind === "create" ? rf.needDescription : kind === "custom" ? rf.needInstruction : rf.needContent;
      setError(intl.formatMessage(needMsg));
      return;
    }
    const resolved = resolveRewrite();
    if (!resolved) return;

    setError("");
    setStatus("");
    setRefineBusy(mode);
    try {
      const out = await rewritePrompt({ providerId: resolved.providerId, prompt, key: resolved.key, mode });
      const cleaned = cleanDplOutput(out);
      if (!cleaned) {
        setError(intl.formatMessage(rf.empty));
        return;
      }
      preRefine.current = dplText ?? "";
      setDplText(cleaned);
      setDirty(true);
      setCanUndo(true);
      const issues = validateDpl(cleaned, intl).filter((d) => d.severity === "error").length;
      if (kind === "create") setStatus(intl.formatMessage(rf.drafted));
      else if (kind === "custom")
        setStatus(intl.formatMessage(issues ? rf.modifiedIssues : rf.modified, { count: issues }));
      else if (issues) setStatus(intl.formatMessage(rf.appliedIssues, { label, count: issues }));
      else setStatus(intl.formatMessage(rf.applied, { label }));
    } catch (e) {
      setError(intl.formatMessage(rf.failed, { error: e.message || String(e) }));
    } finally {
      setRefineBusy("");
    }
  }

  const handleRefine = (action) => runDpl(action.mode, dplText, { label: action.label });
  const handleCreate = (desc) => runDpl(DPL_CREATE_MODE, desc, { kind: "create" });

  // Free-text modify: needs both an instruction and a template to work on. Compose them into the
  // message the `dpl-custom` system prompt expects, then run it like any other refine.
  function handleCustom(instruction) {
    if (!(instruction || "").trim()) {
      setStatus("");
      setError(intl.formatMessage(rf.needInstruction));
      return;
    }
    if (!(dplText || "").trim()) {
      setStatus("");
      setError(intl.formatMessage(rf.needContent));
      return;
    }
    runDpl(DPL_CUSTOM_MODE, buildCustomPrompt(instruction, dplText), { kind: "custom" });
  }

  function undoRefine() {
    if (preRefine.current == null) return;
    setDplText(preRefine.current);
    setDirty(true);
    setCanUndo(false);
    preRefine.current = null;
    setError("");
    setStatus(intl.formatMessage(rf.reverted));
  }

  async function save() {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (dplText !== null) await writeFile(entry.root, `${base}.dpl`, dplText);
      if (jsText !== null) await writeFile(entry.root, `${base}.js`, jsText);
      await saveSidecar(entry.root, base, {
        description: description.trim() || null,
        // Only persist an explicit nsfw flag when the name doesn't already carry the token.
        nsfw: !nameNsfw && nsfwFlag ? true : null,
      });
      setDirty(false);
      setStatus(intl.formatMessage(jsTouched.current ? msgs.savedJs : msgs.saved));
      await onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function rename() {
    const clean = name.trim().replace(/\.(dpl|js|json)$/i, "");
    if (!clean || clean === entry.label) return;
    const target = folder ? `${folder}/${clean}` : clean;
    setSaving(true);
    setError("");
    try {
      if (dplText !== null) await fsOp("move", { root: entry.root, path: `${base}.dpl`, to: `${target}.dpl` });
      if (jsText !== null) await fsOp("move", { root: entry.root, path: `${base}.js`, to: `${target}.js` });
      try {
        await fsOp("move", { root: entry.root, path: `${base}.json`, to: `${target}.json` });
      } catch {
        // no sidecar to move — fine
      }
      setStatus(intl.formatMessage(msgs.renamed));
      await onChanged?.({ ...entry, path: target, label: clean });
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

  const hasJs = jsText !== null;
  const showDpl = dplText !== null;

  return (
    <section className="card mg-detail mg-editor">
      <div className="mg-editor-head">
        <input
          className="mg-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={intl.formatMessage(msgs.genName)}
        />
        <span className="mg-kind kind-generator">{intl.formatMessage(msgs.block)}</span>
        <button className="link-btn" onClick={rename} disabled={saving || name.trim() === entry.label}>
          {intl.formatMessage(msgs.rename)}
        </button>
        <div className="grow" />
        {tab === "dpl" && dplText !== null && <DplStatus value={dplText} className="mg-status" />}
        <button className="primary" onClick={save} disabled={saving || (!dirty && !jsTouched.current)}>
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

      <label className={`mg-field mg-nsfw-field${!includeAdult || nameNsfw ? " is-disabled" : ""}`}>
        <input
          type="checkbox"
          checked={nsfwFlag}
          disabled={!includeAdult || nameNsfw}
          onChange={(e) => {
            setNsfwFlag(e.target.checked);
            setDirty(true);
          }}
        />
        <span
          title={intl.formatMessage(
            nameNsfw ? msgs.nsfwFromNameTitle : !includeAdult ? msgs.nsfwDisabledTitle : msgs.nsfwMarkTitle,
          )}
        >
          {intl.formatMessage(nameNsfw ? msgs.nsfwLabelFromName : msgs.nsfwLabel)}
        </span>
      </label>

      {showDpl && hasJs && (
        <div className="mg-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "dpl"} className={`mg-tab${tab === "dpl" ? " on" : ""}`} onClick={() => setTab("dpl")}>
            {intl.formatMessage(msgs.tabDpl)}
          </button>
          <button role="tab" aria-selected={tab === "js"} className={`mg-tab${tab === "js" ? " on" : ""}`} onClick={() => setTab("js")}>
            {intl.formatMessage(msgs.tabJs)}
          </button>
        </div>
      )}

      {showDpl && tab === "dpl" && (
        <>
          <DplInsertBar editorRef={dplEditorRef} settings={settings} />
          <DplRefineBar busyMode={refineBusy} disabled={saving} onRefine={handleRefine} />
        </>
      )}

      <div className="mg-editor-body">
        {showDpl && tab === "dpl" && (
          <div className="dpl-editor-wrap">
            <DplEditor
              ref={dplEditorRef}
              value={dplText}
              onChange={(v) => {
                setDplText(v);
                setDirty(true);
                setCanUndo(false); // a manual edit supersedes the last refine's revert point
              }}
              settings={settings}
              className="mg-cm"
              ariaLabel={intl.formatMessage(msgs.ariaDpl)}
            />
            <DplAskCorner busyMode={refineBusy} disabled={saving} onCreate={handleCreate} onCustom={handleCustom} />
          </div>
        )}
        {hasJs && tab === "js" && (
          <CodeEditor
            value={jsText}
            onChange={(v) => {
              setJsText(v);
              jsTouched.current = true;
              setDirty(true);
            }}
            language={javascript}
            className="mg-cm"
            ariaLabel={intl.formatMessage(msgs.ariaJs)}
          />
        )}
      </div>

      <div className="mg-editor-foot">
        {!hasJs && (
          <button className="link-btn" onClick={createJsSidecar}>
            {intl.formatMessage(msgs.createJs)}
          </button>
        )}
        {canUndo && (
          <button className="link-btn" onClick={undoRefine} disabled={saving || Boolean(refineBusy)}>
            {intl.formatMessage(rf.undo)}
          </button>
        )}
        {hasJs && <span className="mg-note">{intl.formatMessage(msgs.jsNote)}</span>}
        {status && <span className="mg-ok">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
