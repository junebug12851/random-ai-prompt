/**
 * @file Contract tests for the text-provider rewrite adapters (auto-fix): OpenAI + Grok
 * (OpenAI-compatible chat) and Gemini (generateContent). MSW-backed.
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import openaiRewrite from "../../shared/openai/code/rewrite.js";
import geminiRewrite from "../../shared/gemini/code/rewrite.js";
import grokRewrite from "../../shared/grok/code/rewrite.js";

describe("openai rewrite", () => {
  it("sends the system + user messages and returns the trimmed content", async () => {
    let body;
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ choices: [{ message: { content: "  clean prompt  " } }] });
      }),
    );
    const out = await openaiRewrite({ prompt: "messy", key: "sk", system: "SYS" });
    expect(out.text).toBe("clean prompt");
    expect(body.messages).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "messy" },
    ]);
  });

  it("throws when the model returns no content", async () => {
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "" } }] }),
      ),
    );
    await expect(openaiRewrite({ prompt: "x", key: "sk" })).rejects.toThrow(/no rewrite/i);
  });

  it("throws the API error message on failure", async () => {
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", () =>
        HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 }),
      ),
    );
    await expect(openaiRewrite({ prompt: "x", key: "sk" })).rejects.toThrow(/rate limited/);
  });
});

describe("gemini rewrite", () => {
  it("joins the candidate text parts", async () => {
    server.use(
      http.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        () => HttpResponse.json({ candidates: [{ content: { parts: [{ text: "clean " }, { text: "prompt" }] } }] }),
      ),
    );
    expect((await geminiRewrite({ prompt: "x", key: "gk" })).text).toBe("clean prompt");
  });
});

describe("grok rewrite", () => {
  it("uses the xAI chat endpoint and returns the content", async () => {
    server.use(
      http.post("https://api.x.ai/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "fixed" } }] }),
      ),
    );
    expect((await grokRewrite({ prompt: "x", key: "xk" })).text).toBe("fixed");
  });
});
