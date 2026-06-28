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
import { javascript } from "@codemirror/lang-javascript";
import { readFile, writeFile, saveSidecar, fsOp } from "../lib/manageApi.js";
import { hasNsfwToken } from "../../../src/gatedLists.js";
import DplEditor from "./DplEditor.jsx";
import CodeEditor from "./CodeEditor.jsx";

const JS_BOILERPLATE = `/**
 * JS sidecar for this generator. Return a string to inject (or "" to contribute nothing).
 * The .dpl calls it via \`script:\`, \`{js:}\`, or \`insert js:\`.
 */
export default function (settings, imageSettings, upscaleSettings) {
  return "";
}

// export const full = true;             // treat the output as a full prompt
// export const suggestion_exclude = true; // keep this generator out of random suggestions
`;

/**
 * @param {object} props
 * @param {object} props.entry The selected generator entry `{ root, path, ext, label, hasJsSidecar }`.
 * @param {object} props.settings App settings (DPL example expansion + `includeAdult` gating).
 * @param {Function} props.onChanged Called after a save/rename to hot-apply + refresh the tree.
 *   Receives the new logical path on a rename.
 * @returns {JSX.Element}
 */
export default function ManageBlockEditor({ entry, settings, onChanged }) {
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
  const jsTouched = useRef(false);

  // (Re)load whenever the selected generator changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setStatus("");
    setDirty(false);
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
      setStatus(jsTouched.current ? "Saved — reload the app to run the changed JS." : "Saved.");
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
      setStatus("Renamed.");
      await onChanged?.({ ...entry, path: target, label: clean });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="card mg-detail"><p className="empty">Loading…</p></section>;

  const hasJs = jsText !== null;
  const showDpl = dplText !== null;

  return (
    <section className="card mg-detail mg-editor">
      <div className="mg-editor-head">
        <input
          className="mg-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Generator name"
        />
        <span className="mg-kind kind-generator">block</span>
        <button className="link-btn" onClick={rename} disabled={saving || name.trim() === entry.label}>
          Rename
        </button>
        <div className="grow" />
        <button className="primary" onClick={save} disabled={saving || (!dirty && !jsTouched.current)}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <label className="mg-field">
        <span>Description</span>
        <input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setDirty(true);
          }}
          placeholder="Editor tooltip for this block"
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
          title={
            nameNsfw
              ? "This name contains an 'nsfw' token, so it's always NSFW."
              : !includeAdult
                ? "NSFW option only available in NSFW mode."
                : "Mark this block as NSFW (gated behind adult mode)."
          }
        >
          NSFW{nameNsfw ? " (from name)" : ""}
        </span>
      </label>

      {showDpl && hasJs && (
        <div className="mg-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "dpl"} className={`mg-tab${tab === "dpl" ? " on" : ""}`} onClick={() => setTab("dpl")}>
            DPL
          </button>
          <button role="tab" aria-selected={tab === "js"} className={`mg-tab${tab === "js" ? " on" : ""}`} onClick={() => setTab("js")}>
            JS sidecar
          </button>
        </div>
      )}

      <div className="mg-editor-body">
        {showDpl && tab === "dpl" && (
          <DplEditor
            value={dplText}
            onChange={(v) => {
              setDplText(v);
              setDirty(true);
            }}
            settings={settings}
            className="mg-cm"
            ariaLabel="Generator DPL"
          />
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
            ariaLabel="Generator JS sidecar"
          />
        )}
      </div>

      <div className="mg-editor-foot">
        {!hasJs && (
          <button className="link-btn" onClick={createJsSidecar}>
            + Create JS sidecar
          </button>
        )}
        {hasJs && <span className="mg-note">JS runs on reload — DPL and the rest hot-apply.</span>}
        {status && <span className="mg-ok">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </section>
  );
}
