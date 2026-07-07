/**
 * Hover-dials for DPL `{#…}` block references. When the pointer rests on a generator reference in
 * any {@link module:gui/components/DplEditor DplEditor}, two little speedometer dials — INTENSITY and
 * FOCUS — float just above it. Each reads the reference's current `iNN%` / `fNN%` argument (default
 * 50, dead-center / straight-up on the gauge) and lets the user drag it 1‥100. Releasing writes the
 * new value back into that one reference; landing on exactly 50 (the default) drops the argument
 * entirely, so the reference stays clean.
 *
 * It's a plain CodeMirror {@link ViewPlugin} (no React) so it works identically in the prompt /
 * negative / gallery / Manage boxes that all share DplEditor. The overlay is a DOM panel appended to
 * the editor and positioned from `coordsAtPos`; it re-anchors on scroll and after each edit.
 * @module gui/lib/dpl/dplDials
 */
import { ViewPlugin } from "@codemirror/view";

// A `{#name}` reference with its optional dial args — `{#scene}`, `{#fragment/nature i70% f30%}`.
// The capture split lets us re-read / rewrite the args without touching the name.
const REF_RE = /\{#([\w/-]+)((?:\s+[if][+-]?\d{1,3}%)*)\s*\}/g;

// Pull the absolute `iNN%` / `fNN%` out of a reference's argument tail (signed relative mods like
// `i+25%` aren't absolute values, so they read as "unset" — a drag then writes an absolute one).
function readDial(argText, key) {
  const m = new RegExp(`(?:^|\\s)${key}(\\d{1,3})%`, "i").exec(argText || "");
  if (!m) return null;
  const n = Math.min(100, Math.max(1, Number(m[1])));
  return n;
}

// Rebuild a reference string from its name and the two dial values (null = default 50 = omitted).
function buildRef(name, i, f) {
  let out = `{#${name}`;
  if (i != null) out += ` i${i}%`;
  if (f != null) out += ` f${f}%`;
  return out + "}";
}

// Gauge geometry: value 1‥100 → angle measured from straight-up, clockwise positive, so 50 sits dead
// center (0°, pointing up) and the sweep runs ±135°.
const SWEEP = 135;
const valToAngle = (v) => ((v - 50) / 50) * SWEEP;
const angleToVal = (deg) => Math.round(50 + (deg / SWEEP) * 50);
const clampVal = (v) => Math.min(100, Math.max(1, v));
// A point on the gauge at radius r for a value (SVG coords, center at cx,cy; up is -y).
function gaugePoint(cx, cy, r, v) {
  const a = (valToAngle(v) * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/**
 * Build one draggable speedometer dial. Returns `{ el, setValue }` where `el` is the dial DOM and
 * `setValue(v)` re-renders it. `onInput(v)` fires live during a drag; `onCommit(v)` on release.
 */
function makeDial({ label, value, onInput, onCommit }) {
  const SIZE = 58;
  const C = SIZE / 2;
  const R = 22;
  let cur = value == null ? 50 : value;

  const wrap = document.createElement("div");
  wrap.className = "dpl-dial";

  const svg = svgEl("svg", { class: "dpl-dial-svg", width: SIZE, height: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}` });
  // Full track (min → max).
  const [tx0, ty0] = gaugePoint(C, C, R, 1);
  const [tx1, ty1] = gaugePoint(C, C, R, 100);
  svg.appendChild(svgEl("path", { class: "dpl-dial-track", d: `M ${tx0} ${ty0} A ${R} ${R} 0 1 1 ${tx1} ${ty1}` }));
  // Center tick (the "50" home) — a short mark straight up.
  svg.appendChild(svgEl("line", { class: "dpl-dial-home", x1: C, y1: C - R + 3, x2: C, y2: C - R - 1 }));
  const fill = svgEl("path", { class: "dpl-dial-fill", d: "" });
  svg.appendChild(fill);
  const needle = svgEl("line", { class: "dpl-dial-needle", x1: C, y1: C, x2: C, y2: C - R });
  svg.appendChild(needle);
  svg.appendChild(svgEl("circle", { class: "dpl-dial-hub", cx: C, cy: C, r: 3 }));
  wrap.appendChild(svg);

  const num = document.createElement("span");
  num.className = "dpl-dial-num";
  wrap.appendChild(num);
  const cap = document.createElement("span");
  cap.className = "dpl-dial-label";
  cap.textContent = label;
  wrap.appendChild(cap);

  function render() {
    const [nx, ny] = gaugePoint(C, C, R, cur);
    needle.setAttribute("x2", nx);
    needle.setAttribute("y2", ny);
    // Fill from the 50-home to the current value (shows deviation either side of center).
    const large = 0; // ≤180° between 50 and any value
    const [hx, hy] = gaugePoint(C, C, R, 50);
    const sweepFlag = cur >= 50 ? 1 : 0;
    fill.setAttribute("d", cur === 50 ? "" : `M ${hx} ${hy} A ${R} ${R} 0 ${large} ${sweepFlag} ${nx} ${ny}`);
    num.textContent = String(cur);
    wrap.classList.toggle("is-default", cur === 50);
  }
  render();

  // Drag: map the pointer's angle around the dial center to a value, with a snap window at 50.
  function valueFromEvent(e) {
    const rect = svg.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise positive
    deg = Math.max(-SWEEP, Math.min(SWEEP, deg));
    let v = clampVal(angleToVal(deg));
    if (Math.abs(v - 50) <= 3) v = 50; // easy to land on the home/default
    return v;
  }
  let dragging = false;
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    cur = valueFromEvent(e);
    render();
    onInput?.(cur);
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    onCommit?.(cur);
    e.preventDefault();
  }
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    cur = valueFromEvent(e);
    render();
    onInput?.(cur);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
  });
  // Double-click the dial to snap home (50 → clears the argument).
  svg.addEventListener("dblclick", (e) => {
    cur = 50;
    render();
    onCommit?.(cur);
    e.preventDefault();
  });

  return {
    el: wrap,
    setValue(v) {
      cur = v == null ? 50 : clampVal(v);
      render();
    },
  };
}

/**
 * The dials extension. `labels` supplies the localized dial captions + hint.
 * @param {{intensity: string, focus: string, hint: string}} labels
 * @returns {import("@codemirror/state").Extension}
 */
export function dplDials(labels = {}) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.active = null; // { from, name, i, f }
        this.panel = null;
        this.overIt = false; // pointer is over the panel
        this.dragging = false;
        this.onDocMove = this.onDocMove.bind(this);
        this.onScroll = this.reposition.bind(this);
        view.dom.addEventListener("mousemove", this.onDocMove);
        view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
        view.dom.addEventListener("mouseleave", () => this.maybeHide());
      }

      destroy() {
        this.view.dom.removeEventListener("mousemove", this.onDocMove);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.hide();
      }

      update(u) {
        // After an external doc change (not our own edit), a stale panel could mis-anchor — drop it.
        if (u.docChanged && !this.dragging) this.reanchor();
      }

      // Find the `{#…}` reference the pointer is inside, if any: {from, to, name, argText}.
      refAt(clientX, clientY) {
        const view = this.view;
        const pos = view.posAtCoords({ x: clientX, y: clientY }, false);
        if (pos == null) return null;
        const line = view.state.doc.lineAt(pos);
        REF_RE.lastIndex = 0;
        let m;
        while ((m = REF_RE.exec(line.text))) {
          const from = line.from + m.index;
          const to = from + m[0].length;
          if (pos < from || pos > to) continue;
          // Confirm the pointer is really over the reference's glyphs (posAtCoords snaps to nearest).
          const a = view.coordsAtPos(from);
          const b = view.coordsAtPos(to);
          if (!a || !b) continue;
          const top = Math.min(a.top, b.top);
          const bottom = Math.max(a.bottom, b.bottom);
          if (clientY < top - 2 || clientY > bottom + 2) continue;
          if (clientX < Math.min(a.left, b.left) - 4 || clientX > Math.max(a.right, b.right) + 4) continue;
          return { from, to, name: m[1], argText: m[2] || "" };
        }
        return null;
      }

      onDocMove(e) {
        if (this.dragging || this.overIt) return;
        const ref = this.refAt(e.clientX, e.clientY);
        if (!ref) {
          this.maybeHide();
          return;
        }
        if (this.active && this.active.from === ref.from && this.panel) {
          this.active.to = ref.to;
          return; // same ref — leave the panel be
        }
        this.show(ref);
      }

      maybeHide() {
        if (this.dragging || this.overIt) return;
        // A short grace so the pointer can travel from the ref up into the panel.
        clearTimeout(this._hideT);
        this._hideT = setTimeout(() => {
          if (!this.dragging && !this.overIt) this.hide();
        }, 120);
      }

      hide() {
        clearTimeout(this._hideT);
        if (this.panel) {
          this.panel.remove();
          this.panel = null;
        }
        this.active = null;
      }

      show(ref) {
        this.hide();
        this.active = { ...ref, i: readDial(ref.argText, "i"), f: readDial(ref.argText, "f") };
        const panel = document.createElement("div");
        panel.className = "dpl-dials";
        panel.addEventListener("mouseenter", () => {
          this.overIt = true;
          clearTimeout(this._hideT);
        });
        panel.addEventListener("mouseleave", () => {
          this.overIt = false;
          this.maybeHide();
        });

        const commit = () => {
          this.dragging = false;
        };
        const write = (which, v) => {
          if (which === "i") this.active.i = v === 50 ? null : v;
          else this.active.f = v === 50 ? null : v;
          this.applyEdit();
        };

        const iDial = makeDial({
          label: labels.intensity || "intensity",
          value: this.active.i,
          onInput: () => (this.dragging = true),
          onCommit: (v) => {
            write("i", v);
            commit();
          },
        });
        const fDial = makeDial({
          label: labels.focus || "focus",
          value: this.active.f,
          onInput: () => (this.dragging = true),
          onCommit: (v) => {
            write("f", v);
            commit();
          },
        });
        this._iDial = iDial;
        this._fDial = fDial;
        panel.appendChild(iDial.el);
        panel.appendChild(fDial.el);

        document.body.appendChild(panel);
        this.panel = panel;
        this.reposition();
      }

      // Rewrite the active reference in-place with the current dial values, then re-anchor.
      applyEdit() {
        const a = this.active;
        if (!a) return;
        const next = buildRef(a.name, a.i, a.f);
        const cur = this.view.state.sliceDoc(a.from, a.to);
        if (cur === next) return;
        this.view.dispatch({ changes: { from: a.from, to: a.to, insert: next } });
        a.to = a.from + next.length;
        this.reposition();
      }

      // Re-find the active reference's range after an edit (its `to` may have shifted).
      reanchor() {
        const a = this.active;
        if (!a) return;
        const line = this.view.state.doc.lineAt(a.from);
        REF_RE.lastIndex = 0;
        let m;
        while ((m = REF_RE.exec(line.text))) {
          const from = line.from + m.index;
          if (from === a.from) {
            a.to = from + m[0].length;
            a.i = readDial(m[2] || "", "i");
            a.f = readDial(m[2] || "", "f");
            this._iDial?.setValue(a.i);
            this._fDial?.setValue(a.f);
            this.reposition();
            return;
          }
        }
        this.hide(); // reference gone (deleted / heavily edited)
      }

      reposition() {
        if (!this.panel || !this.active) return;
        const a = this.active;
        const start = this.view.coordsAtPos(a.from);
        const end = this.view.coordsAtPos(a.to);
        if (!start || !end) {
          this.maybeHide();
          return;
        }
        // Fixed positioning (panel is on document.body): use viewport coords straight from CodeMirror.
        const midX = (start.left + end.right) / 2;
        const topY = Math.min(start.top, end.top);
        this.panel.style.left = `${midX}px`;
        this.panel.style.top = `${topY}px`;
      }
    },
  );
}

export default dplDials;
