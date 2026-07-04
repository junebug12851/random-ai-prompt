/**
 * A controlled CodeMirror 6 editor for DPL boxes (the prompt, the negative prompt, the wrapper
 * Start/End). It behaves like a `<textarea>` — `value` + `onChange(next)` so the parent owns
 * state — but adds DPL syntax highlighting and a brace-aware autocomplete dropdown of every
 * list / generator token. Line wrapping is on; height is driven by CSS (`.dpl-editor`).
 *
 * The catalog is read lazily per-completion (so browser-local custom blocks show up without a
 * remount), and edits made while the parent re-renders don't echo back into the document (the
 * latest `value` is tracked in a ref and compared before re-dispatching).
 * @module gui/components/DplEditor
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useIntl } from "react-intl";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, drawSelection } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, insertNewlineAndIndent } from "@codemirror/commands";
import { autocompletion, completionKeymap, snippet, startCompletion } from "@codemirror/autocomplete";
import { linter } from "@codemirror/lint";
import { dplLanguage, dplCompletionSource, dplKindBadge, inFrontMatter } from "../lib/dpl/dplLanguage.js";
import { getDplCompletions, expandPrompt } from "../lib/promptEngine.js";
import { validateDpl } from "../lib/dpl/validateDpl.js";

// CodeMirror linter fed by the shared DPL validator — underlines bad spots and shows the message on
// hover; the gutter marks each line with an issue. The same validator backs the editors' status icon.
// A factory so the linter can read the live `intl` (via a ref) for localized diagnostics.
const makeDplLinter = (intlRef) =>
  linter((view) => {
    const text = view.state.doc.toString();
    const len = text.length;
    return validateDpl(text, intlRef.current).map((d) => ({
      from: Math.min(d.from, len),
      to: Math.min(Math.max(d.to, d.from + 1), len),
      severity: d.severity,
      message: d.message,
    }));
  });

// Render a token into a concrete example for the autocomplete info panel (no auto-FX/auto-artist
// noise, mirroring the eye-icon live preview).
const expandExample = (token, settings) =>
  expandPrompt(token, { ...settings, autoAddFx: false, autoAddArtists: false });

/**
 * @param {object} props
 * @param {string} props.value The DPL text (controlled).
 * @param {Function} props.onChange `(next)` — called on user edits.
 * @param {string} [props.placeholder] Placeholder shown when empty (may change over time).
 * @param {string} [props.className] Extra class on the wrapper (e.g. `prompt-input`).
 * @param {string} [props.ariaLabel] Accessible label for the editor.
 * @param {object} [props.settings] Generation settings — used to roll the live example in the
 *   autocomplete info panel with the correct SFW/NSFW gating. Read lazily, so updates don't remount.
 * @param {import("react").Ref} ref Imperative handle: `{ insertSnippet(template, opts), focus() }`.
 * @returns {JSX.Element}
 */
function DplEditor(
  { value, onChange, placeholder = "", className = "", ariaLabel, settings },
  ref,
) {
  const intl = useIntl();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const placeholderCompartment = useRef(new Compartment());
  const labelCompartment = useRef(new Compartment());

  // Imperative handle for the DPL insert toolbar: drop a snippet at the cursor (or wrap the
  // selection), with CodeMirror's `${…}` tab stops so the user can tab through the blanks.
  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      insertSnippet: (template, opts = {}) => {
        const view = viewRef.current;
        if (!view || !template) return;
        const sel = view.state.selection.main;
        let tpl = template;
        if (opts.wrap) {
          const selText = view.state.sliceDoc(sel.from, sel.to);
          tpl = tpl.replace("${sel}", selText ? `\${1:${selText}}` : "${1}");
        }
        if (opts.line) {
          // Line-leading constructs need their own line — prepend a newline if the cursor's line
          // already has content before it.
          const line = view.state.doc.lineAt(sel.from);
          if (view.state.sliceDoc(line.from, sel.from).trim() !== "") tpl = `\n${tpl}`;
        }
        view.focus();
        snippet(tpl)(view, null, sel.from, sel.to);
      },
    }),
    [],
  );

  // Build the editor once (mount). The completion source reads the catalog lazily each time.
  useEffect(() => {
    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const doc = update.state.doc.toString();
      if (doc !== valueRef.current) {
        valueRef.current = doc;
        onChangeRef.current?.(doc);
      }
    });

    const state = EditorState.create({
      doc: value ?? "",
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        dplLanguage(),
        makeDplLinter(intlRef),
        autocompletion({
          override: [
            dplCompletionSource(getDplCompletions, {
              expand: expandExample,
              getSettings: () => settingsRef.current || {},
            }),
          ],
          icons: false,
          addToOptions: [{ render: dplKindBadge, position: 70 }],
        }),
        keymap.of([
          ...completionKeymap,
          // Inside the leading `---` front-matter block, pressing Enter drops to a fresh line and
          // immediately re-opens the key suggestions, so the front-matter keys are discoverable
          // one after another. (Placed after completionKeymap so Enter still *accepts* an open
          // completion; only a plain Enter falls through to here.)
          {
            key: "Enter",
            run: (view) => {
              if (!inFrontMatter(view.state, view.state.selection.main.head)) return false;
              const handled = insertNewlineAndIndent(view);
              if (inFrontMatter(view.state, view.state.selection.main.head)) startCompletion(view);
              return handled;
            },
          },
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        placeholderCompartment.current.of(placeholderExt(placeholder)),
        labelCompartment.current.of(
          ariaLabel ? EditorView.contentAttributes.of({ "aria-label": ariaLabel }) : [],
        ),
        EditorView.theme({ "&": { height: "100%" } }),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    valueRef.current = value ?? "";
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (Random / Clear / preset) into the document.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if ((value ?? "") !== cur) {
      valueRef.current = value ?? "";
      view.dispatch({ changes: { from: 0, to: cur.length, insert: value ?? "" } });
    }
  }, [value]);

  // Reconfigure the (possibly rotating) placeholder without rebuilding the editor.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: placeholderCompartment.current.reconfigure(placeholderExt(placeholder)),
    });
  }, [placeholder]);

  return <div ref={hostRef} className={`dpl-editor ${className}`.trim()} />;
}

export default forwardRef(DplEditor);
