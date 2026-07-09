/**
 * A small controlled CodeMirror 6 editor for plain text / code — used by Manage for JS sidecars and
 * raw list editing (where the DPL-specific `DplEditor` would be wrong). It behaves like a textarea
 * (`value` + `onChange`), takes an optional language extension, and is built for large documents
 * (CodeMirror only renders the viewport, so multi-thousand-line lists stay smooth).
 * @module gui/components/CodeEditor
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt, drawSelection, lineNumbers } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import { editorChromeTheme } from "../lib/editorChrome.js";

// Token → CSS class. Colors are set theme-aware in styles.css (`.cm-tok-*`), reusing the same
// palette as the DPL highlighter so code reads consistently in both light and dark themes.
const codeHighlightStyle = HighlightStyle.define([
  {
    tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword],
    class: "cm-tok-keyword",
  },
  { tag: [t.string, t.special(t.string), t.regexp], class: "cm-tok-string" },
  { tag: [t.number, t.bool, t.null, t.atom], class: "cm-tok-number" },
  { tag: [t.lineComment, t.blockComment, t.comment, t.docComment], class: "cm-tok-comment" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], class: "cm-tok-func" },
  { tag: [t.propertyName], class: "cm-tok-prop" },
  { tag: [t.typeName, t.className, t.namespace], class: "cm-tok-type" },
  { tag: [t.definition(t.variableName)], class: "cm-tok-def" },
  { tag: [t.operator, t.derefOperator], class: "cm-tok-operator" },
]);

// Editor niceties enabled only when a language is supplied (i.e. editing real code, not a raw
// word list): syntax highlighting, bracket matching, auto-close brackets, and indent-on-input.
const codeBasics = [
  syntaxHighlighting(codeHighlightStyle),
  bracketMatching(),
  closeBrackets(),
  indentOnInput(),
];

/**
 * @param {object} props
 * @param {string} props.value Controlled text.
 * @param {Function} props.onChange `(next)` on edits.
 * @param {Function} [props.language] A CodeMirror language extension factory (e.g. `javascript`).
 * @param {boolean} [props.lineNumbers] Show a line-number gutter.
 * @param {boolean} [props.wrap] Soft-wrap long lines.
 * @param {string} [props.placeholder] Placeholder when empty.
 * @param {string} [props.className] Extra wrapper class.
 * @param {string} [props.ariaLabel] Accessible label.
 * @param {import("react").Ref} ref Imperative handle: `{ focus() }`.
 * @returns {JSX.Element}
 */
function CodeEditor(
  { value, onChange, language, lineNumbers: showGutter = true, wrap = false, placeholder = "", className = "", ariaLabel },
  ref,
) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({ focus: () => viewRef.current?.focus() }), []);

  useEffect(() => {
    const langCompartment = new Compartment();
    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const doc = update.state.doc.toString();
      if (doc !== valueRef.current) {
        valueRef.current = doc;
        onChangeRef.current?.(doc);
      }
    });
    const extensions = [
      history(),
      drawSelection(),
      ...(showGutter ? [lineNumbers()] : []),
      ...(wrap ? [EditorView.lineWrapping] : []),
      langCompartment.of(language ? language() : []),
      // Code affordances (highlighting, bracket matching, …) only when a language is set.
      ...(language ? codeBasics : []),
      // Bracket-close + Tab-indent keys only in code mode; plain-text lists keep normal Tab nav.
      keymap.of(
        language
          ? [...closeBracketsKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]
          : [...historyKeymap, ...defaultKeymap],
      ),
      placeholderExt(placeholder),
      ariaLabel ? EditorView.contentAttributes.of({ "aria-label": ariaLabel }) : [],
      EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto" } }),
      editorChromeTheme,
      updateListener,
    ];
    const state = EditorState.create({ doc: value ?? "", extensions });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    valueRef.current = value ?? "";
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (load / tab switch / revert) into the document.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if ((value ?? "") !== cur) {
      valueRef.current = value ?? "";
      view.dispatch({ changes: { from: 0, to: cur.length, insert: value ?? "" } });
    }
  }, [value]);

  return <div ref={hostRef} className={`code-editor ${className}`.trim()} />;
}

export default forwardRef(CodeEditor);
