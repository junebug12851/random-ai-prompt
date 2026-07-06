/**
 * @file Contract tests for the browser-facing generate adapters: the browser-direct ones
 * (OpenAI, Gemini) that call their server adapter, the hosted ones (Replicate) that post to
 * the proxy, and the local ComfyUI adapter (submit → poll over /api/forward).
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import openaiGenerate from "../../shared/openai/code/generate.js";
import geminiGenerate from "../../shared/gemini/code/generate.js";
import replicateGenerate from "../../shared/replicate/code/generate.js";
import comfyuiGenerate from "../../shared/comfyui/code/generate.js";

describe("openai generate (browser-direct)", () => {
  it("maps settings to params and returns images", async () => {
    let body;
    server.use(
      http.post("https://api.openai.com/v1/images/generations", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: [{ b64_json: "AAAA" }] });
      }),
    );
    const out = await openaiGenerate({
      prompt: "a fox",
      key: "sk",
      settings: { model: "gpt-image-1", size: "256x256", batchSize: 1 },
    });
    expect(out.images).toEqual(["data:image/png;base64,AAAA"]);
    expect(body).toMatchObject({ size: "256x256", n: 1 });
  });
});

describe("gemini generate (browser-direct)", () => {
  it("calls the gemini image model and returns the data URL", async () => {
    server.use(
      http.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        () => HttpResponse.json({ candidates: [{ content: { parts: [{ inlineData: { data: "CCCC" } }] } }] }),
      ),
    );
    const out = await geminiGenerate({ prompt: "p", key: "gk", settings: {} });
    expect(out.images[0]).toMatch(/^data:image\/png;base64,CCCC$/);
  });
});

describe("replicate generate (hosted proxy)", () => {
  it("posts the replicate job to /api/generate with mapped params", async () => {
    let body;
    server.use(
      http.post("/api/generate", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ images: ["https://r/img.png"] });
      }),
    );
    const out = await replicateGenerate({
      prompt: "p",
      key: "r8",
      settings: { model: "owner/model", aspectRatio: "16:9", batchSize: 2 },
    });
    expect(out.images).toEqual(["https://r/img.png"]);
    expect(body).toMatchObject({
      providerId: "replicate",
      params: { model: "owner/model", aspect_ratio: "16:9", n: 2 },
    });
  });
});

describe("comfyui generate (local-direct submit→poll)", () => {
  it("patches the workflow, submits, polls history, and returns /view URLs", async () => {
    server.use(
      http.post("/api/forward", async ({ request }) => {
        const { url } = await request.json();
        if (url.endsWith("/object_info/CheckpointLoaderSimple"))
          return HttpResponse.json({
            CheckpointLoaderSimple: { input: { required: { ckpt_name: [["model.safetensors"]] } } },
          });
        if (url.endsWith("/object_info/KSampler"))
          return HttpResponse.json({
            KSampler: { input: { required: { sampler_name: [["euler"]], scheduler: [["normal"]] } } },
          });
        if (url.endsWith("/prompt")) return HttpResponse.json({ prompt_id: "p1" });
        if (url.includes("/history/"))
          return HttpResponse.json({
            p1: { outputs: { n9: { images: [{ filename: "f.png", subfolder: "", type: "output" }] } } },
          });
        return HttpResponse.json({});
      }),
    );
    const out = await comfyuiGenerate({
      prompt: "a fox",
      settings: { comfyUrl: "http://127.0.0.1:8188", imageWidth: 512, imageHeight: 512 },
    });
    expect(out.images).toHaveLength(1);
    expect(out.images[0]).toContain("/view?filename=f.png");
  });
});
