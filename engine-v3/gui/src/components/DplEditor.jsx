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
import { useEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, drawSelection } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { dplLanguage, dplCompletionSource } from "../lib/dpl/dplLanguage.js";
import { getDplCompletions } from "../lib/promptEngine.js";

/**
 * @param {object} props
 * @param {string} props.value The DPL text (controlled).
 * @param {Function} props.onChange `(next)` — called on user edits.
 * @param {string} [props.placeholder] Placeholder shown when empty (may change over time).
 * @param {string} [props.className] Extra class on the wrapper (e.g. `prompt-input`).
 * @param {string} [props.ariaLabel] Accessible label for the editor.
 * @returns {JSX.Element}
 */
export default function DplEditor({ value, onChange, placeholder = "", className = "", ariaLabel }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const placeholderCompartment = useRef(new Compartment());
  const labelCompartment = useRef(new Compartment());

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
        autocompletion({ override: [dplCompletionSource(getDplCompletions)], icons: false }),
        keymap.of([...completionKeymap, ...historyKeymap, ...defaultKeymap]),
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
