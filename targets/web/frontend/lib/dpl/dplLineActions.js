/**
 * The `+` line-action affordance for DPL editors. A small `+` sits in a left gutter on the hovered
 * (or cursor) line; clicking it opens a context-aware menu that promotes, replaces, or inserts DPL
 * lines without the author having to remember the lax line grammar.
 *
 * The menu adapts to WHERE the `+` was clicked:
 *   - inside the leading `---` front-matter → offer front-matter keys + blank-line inserts;
 *   - on the very first line with no front matter yet → offer "Insert front matter";
 *   - on a line with content → offer "Promote to" (wrap the text as `- ` / `maybe` / `NN% chance` /
 *     `otherwise` / `[weight]` / `[i<NN%]` condition);
 *   - always → "Replace line with…" (every line-type template), insert a blank line above / below,
 *     and "New section…" (the standard Start / Auto Begin / Auto End, or a custom one).
 *
 * Plain CodeMirror (a {@link StateField} for the hovered line, a {@link ViewPlugin} tracker, and a
 * {@link gutter}); the pop-menu is a `position:fixed` DOM panel on `document.body` so it never clips.
 * All user-facing strings arrive pre-localized in `labels` (DplEditor formats them via `intl`).
 * @module gui/lib/dpl/dplLineActions
 */
import { StateField, StateEffect } from "@codemirror/state";
import { ViewPlugin, gutter, GutterMarker } from "@codemirror/view";

// --- Hovered-line state -------------------------------------------------------------------
const setHoverLine = StateEffect.define();
const hoverLineField = StateField.define({
  create: () => 0,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setHoverLine)) return e.value;
    return value;
  },
});

// The line the `+` should sit on: the hovered line, else the cursor's line.
function targetLine(state) {
  const hov = state.field(hoverLineField, false) || 0;
  if (hov) return hov;
  return state.doc.lineAt(state.selection.main.head).number;
}

// --- Front-matter context helpers --------------------------------------------------------
function fmInfo(doc) {
  if (doc.lines < 1 || doc.line(1).text.trim() !== "---") return { has: false, close: 0 };
  for (let i = 2; i <= doc.lines; i++) {
    if (doc.line(i).text.trim() === "---") return { has: true, close: i };
  }
  return { has: true, close: 0 }; // unterminated — treat rest of doc as front matter
}

// --- Edits -------------------------------------------------------------------------------
const leadWs = (t) => (/^[ \t]*/.exec(t)[0] || "");

function apply(view, changes, cursor) {
  view.dispatch({ changes, ...(cursor != null ? { selection: { anchor: cursor } } : {}) });
  view.focus();
}

// Prepend a construct to a line's content, after any indentation (`maybe `, `- `, `[100] `, …).
function promote(view, line, prefix) {
  const at = line.from + leadWs(line.text).length;
  apply(view, { from: at, insert: prefix }, at + prefix.length);
}

// Replace a whole line with a (possibly multi-line) template, keeping the line's indentation.
function replaceLine(view, line, text) {
  const indent = leadWs(line.text);
  const insert = text
    .split("\n")
    .map((l) => indent + l)
    .join("\n");
  apply(view, { from: line.from, to: line.to, insert }, line.from + insert.length);
}

function insertBlank(view, line, where) {
  const indent = leadWs(line.text);
  if (where === "above") apply(view, { from: line.from, insert: `${indent}\n` }, line.from + indent.length);
  else apply(view, { from: line.to, insert: `\n${indent}` }, line.to + 1 + indent.length);
}

function insertFrontMatter(view) {
  apply(view, { from: 0, insert: "---\ndescription: \n---\n" }, 17); // caret after `description: `
}

function insertFmKey(view, line, text) {
  // Drop the key on its own line right below the clicked front-matter line.
  apply(view, { from: line.to, insert: `\n${text}` }, line.to + 1 + text.length);
}

function insertSection(view, line, name) {
  if (line.text.trim() === "") replaceLine(view, line, `${name}\n===`);
  else apply(view, { from: line.to, insert: `\n\n${name}\n===\n` }, line.to + name.length + 3);
}

// --- Menu model (built from localized labels; DPL literals stay verbatim) ------------------
function buildModel(labels, ctx) {
  const L = labels;
  const promotions = [
    { label: L.promBullet, prefix: "- " },
    { label: L.promMaybe, prefix: "maybe " },
    { label: L.promPct, prefix: "30% chance " },
    { label: L.promOtherwise, prefix: "otherwise " },
    { label: L.promWeight, prefix: "[100] " },
    { label: L.promCond, prefix: "[i<50%] " },
  ];
  const templates = [
    { label: L.tplText, text: "detail" },
    { label: L.tplBullet, text: "- detail" },
    { label: L.tplMaybe, text: "maybe detail" },
    { label: L.tplPct, text: "30% chance detail" },
    { label: L.tplOtherwise, text: "otherwise detail" },
    { label: L.tplWeight, text: "[100] detail" },
    { label: L.tplCond, text: "[i<50%] detail" },
    { label: L.tplOneOf, text: "one of\n  - option\n  - option" },
    { label: L.tplNOf, text: "2 of\n  - option\n  - option\n  - option" },
    { label: L.tplRangeOf, text: "1 to 2 of\n  - option\n  - option" },
    { label: L.tplOneOfNothing, text: "one of (25% nothing)\n  - option\n  - option" },
    { label: L.tplRepeat, text: "repeat 2 times\n  - thing" },
    { label: L.tplRepeatRange, text: "repeat 1 to 3 times\n  - thing" },
    { label: L.tplGoto, text: "go to Section Name" },
    { label: L.tplGoback, text: "go back" },
    { label: L.tplInsert, text: "insert name" },
    { label: L.tplCall, text: "+name" },
    { label: L.tplInsertJs, text: "insert js: path" },
    { label: L.tplComment, text: "; note" },
  ];
  const fmKeys = [
    { label: L.fmDesc, text: "description: " },
    { label: L.fmSuggestions, text: "suggestions: off" },
    { label: L.fmStacking, text: "stacking: true" },
    { label: L.fmScript, text: "script: " },
  ];
  const sections = [
    { label: L.secStart, name: "Start" },
    { label: L.secAutoBegin, name: "Auto Begin" },
    { label: L.secAutoEnd, name: "Auto End" },
    { label: L.secCustom, name: "Section Name", custom: true },
  ];
  return { promotions, templates, fmKeys, sections, ctx };
}

// --- The pop-menu (a self-contained navigable DOM panel) ----------------------------------
function openMenu(view, line, anchor, labels) {
  const doc = view.state.doc;
  const fm = fmInfo(doc);
  const n = line.number;
  const inFM = fm.has && (fm.close ? n <= fm.close : true);
  const isFence = line.text.trim() === "---";
  const hasContent = line.text.trim() !== "" && !isFence && !/^={3,}\s*$/.test(line.text.trim());
  const model = buildModel(labels, { inFM, isFence, hasContent, first: n === 1, fmHas: fm.has });

  const panel = document.createElement("div");
  panel.className = "dpl-la-menu";
  const list = document.createElement("div");
  panel.appendChild(list);

  const close = () => {
    panel.remove();
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", close, true);
    window.removeEventListener("resize", close);
  };
  const act = (fn) => () => {
    fn();
    close();
  };
  const onOutside = (e) => {
    if (!panel.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };

  const item = (label, onClick, arrow = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dpl-la-item";
    const s = document.createElement("span");
    s.textContent = label;
    b.appendChild(s);
    if (arrow) {
      const a = document.createElement("span");
      a.className = "dpl-la-arrow";
      a.textContent = "›";
      b.appendChild(a);
    }
    b.addEventListener("click", onClick);
    return b;
  };
  const header = (text, back) => {
    const h = document.createElement("div");
    h.className = "dpl-la-head";
    if (back) {
      const bk = document.createElement("button");
      bk.type = "button";
      bk.className = "dpl-la-back";
      bk.textContent = "‹";
      bk.addEventListener("click", back);
      h.appendChild(bk);
    }
    const t = document.createElement("span");
    t.textContent = text;
    h.appendChild(t);
    return h;
  };

  const render = (build) => {
    list.replaceChildren();
    build(list);
  };

  const showSub = (title, entries) =>
    render((root) => {
      root.appendChild(header(title, () => render(root0)));
      for (const e of entries) root.appendChild(item(e.label, act(e.run)));
    });

  const root0 = (root) => {
    // Front matter world.
    if (model.ctx.inFM) {
      root.appendChild(header(labels.frontMatter));
      for (const k of model.fmKeys) root.appendChild(item(k.label, act(() => insertFmKey(view, line, k.text))));
      root.appendChild(item(labels.insertAbove, act(() => insertBlank(view, line, "above"))));
      root.appendChild(item(labels.insertBelow, act(() => insertBlank(view, line, "below"))));
      return;
    }
    if (model.ctx.first && !model.ctx.fmHas) {
      root.appendChild(item(labels.insertFrontMatter, act(() => insertFrontMatter(view))));
    }
    if (model.ctx.hasContent) {
      root.appendChild(
        item(labels.promote, () => showSub(labels.promote, model.promotions.map((p) => ({ label: p.label, run: () => promote(view, line, p.prefix) }))), true),
      );
    }
    root.appendChild(
      item(labels.replaceWith, () => showSub(labels.replaceWith, model.templates.map((t) => ({ label: t.label, run: () => replaceLine(view, line, t.text) }))), true),
    );
    root.appendChild(item(labels.insertAbove, act(() => insertBlank(view, line, "above"))));
    root.appendChild(item(labels.insertBelow, act(() => insertBlank(view, line, "below"))));
    root.appendChild(
      item(labels.newSection, () => showSub(labels.newSection, model.sections.map((s) => ({ label: s.label, run: () => insertSection(view, line, s.name) }))), true),
    );
  };

  render(root0);

  // Mount + position (fixed, flipped above/left as needed to stay on-screen).
  panel.style.visibility = "hidden";
  document.body.appendChild(panel);
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  let x = anchor.x;
  let y = anchor.y;
  if (x + pw > window.innerWidth - 8) x = window.innerWidth - pw - 8;
  if (y + ph > window.innerHeight - 8) y = Math.max(8, anchor.y - ph);
  panel.style.left = `${Math.max(8, x)}px`;
  panel.style.top = `${Math.max(8, y)}px`;
  panel.style.visibility = "visible";

  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", close, true);
  window.addEventListener("resize", close);
}

// --- The `+` gutter marker ---------------------------------------------------------------
class PlusMarker extends GutterMarker {
  toDOM() {
    const b = document.createElement("span");
    b.className = "dpl-plus";
    b.textContent = "+";
    return b;
  }
}
const plusMarker = new PlusMarker();

/**
 * The line-action extension: the hovered-line state, its mousemove tracker, and the `+` gutter whose
 * click opens the context menu.
 * @param {object} labels Pre-localized strings for the menu (see DplEditor).
 * @returns {import("@codemirror/state").Extension}
 */
export function dplLineActions(labels = {}) {
  const tracker = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.onMove = (e) => {
          const rect = view.contentDOM.getBoundingClientRect();
          const x = rect.left + 2;
          const pos = view.posAtCoords({ x, y: e.clientY }, false);
          if (pos == null) return;
          const ln = view.state.doc.lineAt(pos).number;
          if (ln !== (view.state.field(hoverLineField, false) || 0))
            view.dispatch({ effects: setHoverLine.of(ln) });
        };
        this.onLeave = () => {
          if (view.state.field(hoverLineField, false)) view.dispatch({ effects: setHoverLine.of(0) });
        };
        view.dom.addEventListener("mousemove", this.onMove);
        view.dom.addEventListener("mouseleave", this.onLeave);
      }
      destroy() {
        this.view.dom.removeEventListener("mousemove", this.onMove);
        this.view.dom.removeEventListener("mouseleave", this.onLeave);
      }
    },
  );

  const g = gutter({
    class: "dpl-la-gutter",
    lineMarker(view, blockLine) {
      const num = view.state.doc.lineAt(blockLine.from).number;
      return num === targetLine(view.state) ? plusMarker : null;
    },
    lineMarkerChange: (u) =>
      (u.startState.field(hoverLineField, false) || 0) !== (u.state.field(hoverLineField, false) || 0) ||
      u.startState.selection.main.head !== u.state.selection.main.head,
    initialSpacer: () => plusMarker,
    domEventHandlers: {
      mousedown(view, blockLine, event) {
        const line = view.state.doc.lineAt(blockLine.from);
        openMenu(view, line, { x: event.clientX + 6, y: event.clientY }, labels);
        event.preventDefault();
        return true;
      },
    },
  });

  return [hoverLineField, tracker, g];
}

export default dplLineActions;
