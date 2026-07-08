/**
 * Random AI Prompt — ComfyUI frontend extension.
 *
 * The "live meshing" layer. It:
 *   1. Adds a Settings entry for the running app's URL (persisted; posted to the Python side).
 *   2. Populates the List / Block / Preset dropdowns LIVE from the engine's catalog.
 *   3. Draws the app icon + brand colours on the plugin's nodes.
 *   4. Renders the "Show Prompt" node's output text on the node.
 *   5. Adds a sidebar tab showing engine connection + catalog counts.
 *
 * It talks to the plugin's OWN same-origin routes (`/random_ai_prompt/*`, registered in routes.py),
 * which proxy to the app backend — so there's no cross-origin/CORS problem.
 */
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

const URL_KEY = "random_ai_prompt.url";

// Which combo widget on each node is catalog-backed, and which catalog key feeds it.
const COMBO_WIDGET = {
  RandomAIPromptList: { widget: "list_name", key: "lists" },
  RandomAIPromptBlock: { widget: "block_name", key: "blocks" },
  RandomAIPromptGenerator: { widget: "preset", key: "presets", prepend: ["none"] },
  RandomAIPromptBatch: { widget: "preset", key: "presets", prepend: ["none"] },
};

// Every node this plugin registers — gets the app icon + brand colours.
const OUR_NODES = new Set([
  "RandomAIPromptGenerator",
  "RandomAIPromptList",
  "RandomAIPromptBlock",
  "RandomAIPromptDPL",
  "RandomAIPromptBatch",
  "RandomAIPromptCombine",
  "RandomAIPromptShow",
]);

// Brand colours (the app's charcoal + mint), applied to node title/body.
const NODE_COLOR = "#2e4b45";
const NODE_BGCOLOR = "#1f2926";

// The app icon, served from this plugin's web/ dir (WEB_DIRECTORY), drawn in each node's title bar.
const ICON = new Image();
ICON.src = new URL("./icon.png", import.meta.url).href;

function serverUrl() {
  try {
    return localStorage.getItem(URL_KEY) || "";
  } catch {
    return "";
  }
}

let _catalog = null; // cached promise; reset when the URL setting changes
async function catalog() {
  if (_catalog) return _catalog;
  _catalog = (async () => {
    try {
      const res = await fetch(`/random_ai_prompt/catalog`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  return _catalog;
}

// Tell the Python side which app URL to use, so GENERATION (not just the dropdowns) honours the
// Settings field.
async function postConfig(url) {
  try {
    await fetch(`/random_ai_prompt/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url || "" }),
    });
  } catch {
    /* ignore — generation falls back to env var / default */
  }
}

function optionsFor(nodeName, cat) {
  const spec = COMBO_WIDGET[nodeName];
  if (!spec || !cat) return null;
  const names = cat[spec.key] || [];
  if (!names.length && !spec.prepend) return null;
  return [...(spec.prepend || []), ...names];
}

function applyWidget(node, cat) {
  const spec = COMBO_WIDGET[node?.comfyClass];
  if (!spec) return;
  const values = optionsFor(node.comfyClass, cat);
  if (!values) return;
  const widget = (node.widgets || []).find((w) => w.name === spec.widget);
  if (!widget) return;
  widget.options = widget.options || {};
  widget.options.values = values;
  if (!values.includes(widget.value)) widget.value = values[0];
}

async function refreshAllNodes() {
  const cat = await catalog();
  for (const node of app.graph?._nodes || []) applyWidget(node, cat);
  app.graph?.setDirtyCanvas?.(true, true);
}

// --- Sidebar: engine connection + catalog counts -----------------------------------------------

async function renderStatus(el) {
  el.innerHTML =
    '<div style="padding:12px;font-family:sans-serif;font-size:13px;line-height:1.5;">' +
    '<div style="font-weight:600;margin-bottom:8px;">Random AI Prompt</div>' +
    '<div id="rap-status">Checking…</div>' +
    '<button id="rap-refresh" style="margin-top:10px;padding:4px 10px;">Refresh</button>' +
    "</div>";
  const statusEl = el.querySelector("#rap-status");
  const update = async () => {
    statusEl.textContent = "Checking…";
    _catalog = null;
    let ok = false;
    let url = "";
    try {
      const s = await (await fetch(`/random_ai_prompt/status`)).json();
      ok = !!s.ok;
      url = s.url || "";
    } catch {
      /* not reachable */
    }
    const cat = await catalog();
    const n = (k) => (cat?.[k] || []).length;
    statusEl.innerHTML = ok
      ? `<span style="color:#3fb950;">● Connected</span><br><small>${url}</small>` +
        `<br>${n("lists")} lists · ${n("blocks")} blocks · ${n("presets")} presets`
      : `<span style="color:#f85149;">● Not reachable</span><br><small>${url || "(default)"}</small>` +
        `<br>Start the app or set the URL in Settings.`;
  };
  el.querySelector("#rap-refresh").onclick = update;
  update();
}

app.registerExtension({
  name: "randomAiPrompt.catalog",

  async setup() {
    app.ui.settings.addSetting({
      id: "randomAiPrompt.serverUrl",
      name: "Random AI Prompt — app URL (blank = http://127.0.0.1:4173)",
      type: "text",
      defaultValue: "",
      onChange: async (value) => {
        try {
          localStorage.setItem(URL_KEY, value || "");
        } catch {
          /* ignore storage errors */
        }
        await postConfig(value); // GENERATION honours this too, not just the dropdowns
        _catalog = null; // re-fetch the catalog against the new URL
        refreshAllNodes();
      },
    });

    // Optional sidebar tab (newer ComfyUI frontends) — no-ops on versions without the API.
    app.extensionManager?.registerSidebarTab?.({
      id: "randomAiPrompt.status",
      icon: "pi pi-sparkles",
      title: "Random AI Prompt",
      tooltip: "Random AI Prompt — engine status",
      type: "custom",
      render: (el) => renderStatus(el),
    });

    await postConfig(serverUrl()); // sync the persisted URL to the Python side on load
    const cat = await catalog();
    if (!cat || !(cat.lists && cat.lists.length)) {
      const msg =
        "Random AI Prompt: couldn't reach the app. Start the desktop app (or `npm start`), " +
        "or set the app URL in Settings. Nodes still load; dropdowns fill once it's reachable.";
      console.warn(`[Random AI Prompt] ${msg}`);
      app.extensionManager?.toast?.add?.({
        severity: "warn",
        summary: "Random AI Prompt",
        detail: msg,
        life: 8000,
      });
    }
  },

  // At registration: draw the app icon on our nodes' title bars, wire the Show node's text display,
  // and patch the combo options so freshly created nodes get live catalog values.
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (!OUR_NODES.has(nodeData?.name)) return;

    // App icon, top-right of the title bar, over whatever the node draws.
    const origDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      origDraw?.apply(this, arguments);
      if (this.flags?.collapsed || !ICON.complete || !ICON.naturalWidth) return;
      const size = 18;
      const titleH = window.LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
      ctx.drawImage(ICON, this.size[0] - size - 6, -titleH + (titleH - size) / 2, size, size);
    };

    // "Show Prompt": render the executed text into a read-only multiline widget on the node.
    if (nodeData.name === "RandomAIPromptShow") {
      const origExec = nodeType.prototype.onExecuted;
      nodeType.prototype.onExecuted = function (message) {
        origExec?.apply(this, arguments);
        const text = Array.isArray(message?.text) ? message.text.join("") : (message?.text ?? "");
        let widget = (this.widgets || []).find((w) => w.name === "shown_text");
        if (!widget) {
          widget = ComfyWidgets["STRING"](
            this,
            "shown_text",
            ["STRING", { multiline: true }],
            app,
          ).widget;
          if (widget.inputEl) widget.inputEl.readOnly = true;
        }
        widget.value = text;
        requestAnimationFrame(() => this.setSize?.(this.computeSize()));
      };
    }

    // Live catalog dropdowns (combo nodes only).
    const spec = COMBO_WIDGET[nodeData.name];
    if (!spec) return;
    const cat = await catalog();
    const values = optionsFor(nodeData.name, cat);
    if (!values) return;
    const input = nodeData.input?.required?.[spec.widget];
    if (input && Array.isArray(input[0])) input[0] = values;
  },

  // Per-instance: brand colours + a live-catalog dropdown refresh.
  async nodeCreated(node) {
    if (!OUR_NODES.has(node?.comfyClass)) return;
    node.color = NODE_COLOR;
    node.bgcolor = NODE_BGCOLOR;
    if (COMBO_WIDGET[node.comfyClass]) applyWidget(node, await catalog());
  },
});
