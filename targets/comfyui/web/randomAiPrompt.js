/**
 * Random AI Prompt — ComfyUI frontend extension.
 *
 * The "live meshing" layer. It:
 *   1. Adds a Settings entry for the running app's URL (persisted; passed to the proxy routes).
 *   2. Populates the List / Block / Preset dropdowns LIVE from the engine's catalog — so the app
 *      doesn't need to be running when ComfyUI starts, and edits (in the app's Manage tab) show up on
 *      the next graph interaction.
 *   3. Surfaces a clear warning when the app isn't reachable.
 *   4. Draws the app icon on each of the plugin's node title bars.
 *
 * It talks to the plugin's OWN same-origin routes (`/random_ai_prompt/*`, registered in routes.py),
 * which proxy to the app backend — so there's no cross-origin/CORS problem.
 */
import { app } from "../../scripts/app.js";

const URL_KEY = "random_ai_prompt.url";
// Which combo widget on each of our nodes is catalog-backed, and which catalog key feeds it.
const COMBO_WIDGET = {
  RandomAIPromptList: { widget: "list_name", key: "lists" },
  RandomAIPromptBlock: { widget: "block_name", key: "blocks" },
  RandomAIPromptGenerator: { widget: "preset", key: "presets", prepend: ["none"] },
};

// The four nodes this plugin registers — used to draw the app icon on their title bars.
const OUR_NODES = new Set([
  "RandomAIPromptGenerator",
  "RandomAIPromptList",
  "RandomAIPromptBlock",
  "RandomAIPromptDPL",
]);

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
      // No ?url here: the Python side holds the configured URL (set via /config below), so the
      // dropdowns and generation always resolve the SAME backend.
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
// Settings field. This is the fix for "changing the Setting did nothing" — the node's generate()
// reads this configured URL.
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

function optionsFor(nodeName, cat) {
  const spec = COMBO_WIDGET[nodeName];
  if (!spec || !cat) return null;
  const names = cat[spec.key] || [];
  if (!names.length && !spec.prepend) return null;
  return [...(spec.prepend || []), ...names];
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

  // At registration: draw the app icon on our nodes' title bars, and patch the combo options so
  // freshly created nodes get live catalog values even if the Python side couldn't reach the app.
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

    // Live catalog dropdowns (combo nodes only).
    const spec = COMBO_WIDGET[nodeData.name];
    if (!spec) return;
    const cat = await catalog();
    const values = optionsFor(nodeData.name, cat);
    if (!values) return;
    const input = nodeData.input?.required?.[spec.widget];
    if (input && Array.isArray(input[0])) input[0] = values;
  },

  // Also refresh the widget on an existing node instance (e.g. after the app comes up) so the
  // dropdown isn't stuck on the "(start the app)" placeholder.
  async nodeCreated(node) {
    if (!COMBO_WIDGET[node?.comfyClass]) return;
    applyWidget(node, await catalog());
  },
});
