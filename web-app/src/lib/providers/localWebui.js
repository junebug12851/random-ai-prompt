// Local Stable Diffusion WebUI provider.
//
// Calls the user's OWN WebUI (started with `--api`, CORS enabled) directly from
// the browser — no proxy, no API key. Local mode only; hidden when the app runs
// in online mode.
export const localWebuiProvider = {
  id: "local-webui",
  label: "Local Stable Diffusion WebUI",
  local: true,
  needsKey: false,

  async generate({ prompt, settings, signal }) {
    const base = (settings.localWebuiUrl || "http://127.0.0.1:7860").replace(/\/+$/, "");
    const res = await fetch(`${base}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        prompt,
        negative_prompt: settings.negativePrompt || "",
        steps: settings.imageSteps,
        cfg_scale: settings.cfg,
        width: settings.imageWidth,
        height: settings.imageHeight,
        sampler_index: settings.sampler,
      }),
    });
    if (!res.ok) throw new Error(`WebUI returned ${res.status}`);
    const data = await res.json();
    return {
      images: (data.images || []).map((b64) => `data:image/png;base64,${b64}`),
    };
  },
};
