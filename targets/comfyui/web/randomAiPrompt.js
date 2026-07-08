/**
 * Random AI Prompt — ComfyUI frontend extension.
 *
 * The "live meshing" layer. It:
 *   1. Adds a Settings entry for the running app's URL (persisted; passed to the proxy routes).
 *   2. Populates the List / Block / Preset dropdowns LIVE from the engine's catalog — so the app
 *      doesn't need to be running when ComfyUI starts, and edits (in the app's Manage tab) show up on
 *      the next graph interaction.
 *   3. Surfaces a clear warning when the app isn't reachable.
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
      const u = serverUrl();
      const q = u ? `?url=${encodeURIComponent(u)}` : "";
      const res = await fetch(`/random_ai_prompt/catalog${q}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  return _catalog;
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
      onChange: (value) => {
        try {
          localStorage.setItem(URL_KEY, value || "");
        } catch {
          /* ignore storage errors */
        }
        _catalog = null; // re-fetch against the new URL next time
      },
    });

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

  // Patch the combo options at registration so freshly created nodes get live catalog values even
  // when the Python side couldn't reach the app at import time.
  async beforeRegisterNodeDef(_nodeType, nodeData) {
    const spec = COMBO_WIDGET[nodeData?.name];
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
    const spec = COMBO_WIDGET[node?.comfyClass];
    if (!spec) return;
    const cat = await catalog();
    const values = optionsFor(node.comfyClass, cat);
    if (!values) return;
    const widget = (node.widgets || []).find((w) => w.name === spec.widget);
    if (!widget) return;
    widget.options = widget.options || {};
    widget.options.values = values;
    if (!values.includes(widget.value)) widget.value = values[0];
  },
});
