/**
 * @file
 * @brief Integration tests for the backend's headless prompt routes — `POST /api/prompt` and
 * `GET /api/prompt/catalog` — added for the ComfyUI target. Drives the real `createApiHandler` over a
 * throwaway localhost server (the same shape the CLI's in-process backend uses), so the shared engine +
 * `engine/promptRun.js` are exercised end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createApiHandler } from "../../targets/web/backend/apiHandler.js";

let server;
let base;

beforeAll(async () => {
  const handler = createApiHandler();
  server = http.createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const postPrompt = (body) =>
  fetch(`${base}/api/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/prompt", () => {
  it("generates the requested count of prompts from a template", async () => {
    const res = await postPrompt({ template: "a photo of {keyword}", seed: "42", count: 3 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.seed).toBe("42");
    expect(Array.isArray(json.prompts)).toBe(true);
    expect(json.prompts).toHaveLength(3);
    expect(typeof json.prompts[0]).toBe("string");
    expect(json.prompts[0].length).toBeGreaterThan(0);
  });

  it("is reproducible for a pinned seed and re-rolls without one", async () => {
    const body = { template: "{keyword}, {keyword}, {keyword}", seed: "7", count: 4 };
    const a = await (await postPrompt(body)).json();
    const b = await (await postPrompt(body)).json();
    expect(a.prompts).toEqual(b.prompts); // pinned seed → identical batch

    const r1 = await (await postPrompt({ template: "{keyword}", count: 1 })).json();
    const r2 = await (await postPrompt({ template: "{keyword}", count: 1 })).json();
    expect(r1.seed).not.toEqual(r2.seed); // no seed → a fresh base seed each call
  });

  it("defaults to one prompt and mints a seed when none is given", async () => {
    const res = await postPrompt({ template: "just text" });
    const json = await res.json();
    expect(json.prompts).toHaveLength(1);
    expect(String(json.seed).length).toBeGreaterThan(0);
  });
});

describe("GET /api/prompt/catalog", () => {
  it("returns non-empty list + block catalogs", async () => {
    const res = await fetch(`${base}/api/prompt/catalog`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.lists)).toBe(true);
    expect(json.lists.length).toBeGreaterThan(0);
    expect(Array.isArray(json.blocks)).toBe(true);
    expect(json.blocks.length).toBeGreaterThan(0);
    expect(Array.isArray(json.listGroups)).toBe(true);
    expect(Array.isArray(json.blockGroups)).toBe(true);
  });
});
