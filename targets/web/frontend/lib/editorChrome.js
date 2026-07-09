/**
 * Shared CodeMirror "chrome" theme — the line-number gutter, active line, and selection colors
 * used by every editor (the DPL boxes + Manage's code / list editors).
 *
 * It lives in a CodeMirror `theme` extension (not plain CSS) ON PURPOSE. CodeMirror 6's gutter
 * baseTheme ships BOTH variants — `&light .cm-gutters { background:#f5f5f5 }` and
 * `&dark .cm-gutters { background:#333338 }` — and picks between them by whether the view's theme
 * declares `{ dark: true }`. Our editors never did, so CM stayed in LIGHT mode and injected
 * `.cm-gutters { background:#f5f5f5 }` (a bright-white slab in dark mode), plus the light
 * `.cm-activeLineGutter` (#e2f2ff) and the milky `.cm-activeLine` (rgba(204,238,255,.267)) that
 * washed the current line out. Those injected rules sit at the SAME specificity as an app
 * `.dpl-editor .cm-gutters` rule and beat it on source order — which is why the plain-CSS override
 * never took. A `theme` extension is registered with StyleModule priority OVER the baseTheme, so it
 * wins reliably. Colors are the app's CSS variables, so the chrome still tracks light/dark on its
 * own (no `{ dark: true }` flag needed, which would have hard-pinned it to one mode).
 * @module gui/lib/editorChrome
 */
import { EditorView } from "@codemirror/view";

export const editorChromeTheme = EditorView.theme({
  // A quiet, borderless gutter that blends into the editor: dim, recessed numbers — never a
  // white slab in dark mode.
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "color-mix(in srgb, var(--faint) 55%, transparent)",
  },
  // The active line's number: a clean neutral brighten (no box, no accent glow).
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--muted)",
  },
  // The active line body: a whisper-subtle neutral lift (theme-adaptive via --fg), not a milky
  // accent-tinted wash that drowns the syntax colors.
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--fg) 4.5%, transparent)",
  },
  // Selection: the app accent tint, focused or not.
  ".cm-selectionBackground": {
    backgroundColor: "var(--accent-soft)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--accent-soft)",
  },
});
