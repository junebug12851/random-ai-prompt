/**
 * @file Performance PROFILER for the large-scale scenarios (a companion to the pass/fail perf suite
 * in tests/perf/). Where the Playwright suite asserts budgets, this captures rich, human-readable
 * profiling data for each scenario at the officially supported maximum load — DevTools timeline
 * traces (loadable in chrome://tracing or the DevTools Performance panel), Chromium `Performance`
 * metrics (heap, layout/style recalcs, script + task time), rendered DOM-node counts, and scroll
 * frame-interval stats — so a regression can be diagnosed, not just detected.
 *
 * Usage:  node scripts/profile-scenarios.mjs        (builds + serves + profiles everything)
 *         node scripts/profile-scenarios.mjs gallery generate   (a subset)
 * Output: perf-profile/summary.json + perf-profile/<scenario>-trace.json
 *
 * Runs the REAL release server (targets/web/backend/serve.js) so the Manage file-read path is exercised for
 * real; the 100k gallery feed is route-mocked, same as the test suite.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { MAX_LOAD, bigListText, writePerfList, removePerfList } from "../tests/perf/fixtures.js";
import { routeGallery, scrollAndSampleFrames } from "../tests/perf/helpers.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, "perf-profile");
const PORT = Number(process.env.PERF_PORT) || 4185;
const BASE = `http://localhost:${PORT}`;

const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink.user_timing",
  "v8.execute",
].join(",");

/** Wait until the server answers (or time out). */
async function waitForServer(url, timeoutMs = 240_000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 200) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`server did not start at ${url}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Build the app, then spawn the release server; returns the child + a stop() fn. */
async function startServer() {
  await run("npm", ["run", "web:build"]);
  const child = spawn("node", ["targets/web/backend/serve.js"], {
    cwd: ROOT,
    env: { ...process.env, NO_OPEN: "1", PORT: String(PORT) },
    stdio: "inherit",
  });
  await waitForServer(BASE);
  return {
    child,
    stop: () =>
      new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill();
        setTimeout(resolve, 2000);
      }),
  };
}

/** Run a command to completion, inheriting stdio; rejects on non-zero exit. */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** Capture a DevTools timeline trace around `duringFn`, saving it to disk. */
async function withTrace(page, name, duringFn) {
  const client = await page.context().newCDPSession(page);
  const events = [];
  client.on("Tracing.dataCollected", (e) => events.push(...(e.value || [])));
  let traced = false;
  try {
    await client.send("Tracing.start", {
      transferMode: "ReportEvents",
      categories: TRACE_CATEGORIES,
    });
    traced = true;
  } catch {
    /* tracing unsupported — proceed without a trace */
  }
  const result = await duringFn();
  if (traced) {
    await client.send("Tracing.end");
    await new Promise((r) => client.once("Tracing.tracingComplete", r));
    fs.writeFileSync(path.join(OUT, `${name}-trace.json`), JSON.stringify({ traceEvents: events }));
  }
  return result;
}

/** Chromium Performance metrics as a flat object. */
async function metrics(page) {
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable").catch(() => {});
  const { metrics: m = [] } = await client
    .send("Performance.getMetrics")
    .catch(() => ({ metrics: [] }));
  const pick = (k) => m.find((x) => x.name === k)?.value;
  return {
    heapMB: Math.round((pick("JSHeapUsedSize") || 0) / (1024 * 1024)),
    nodes: pick("Nodes"),
    layoutCount: pick("LayoutCount"),
    recalcStyleCount: pick("RecalcStyleCount"),
    scriptDurationS: round(pick("ScriptDuration")),
    layoutDurationS: round(pick("LayoutDuration")),
    taskDurationS: round(pick("TaskDuration")),
  };
}

const round = (n) => (n == null ? null : Math.round(n * 1000) / 1000);

// --- Scenario drivers: load the app to the target state, then profile a scroll. ---
const scenarios = {
  async gallery(page) {
    await routeGallery(page, MAX_LOAD.galleryImages);
    await page.goto(BASE);
    await page.getByRole("tab", { name: "Gallery" }).click();
    await page.locator(".g-grid .g-cell").first().waitFor({ state: "visible" });
    const frames = await withTrace(page, "gallery", () =>
      scrollAndSampleFrames(page, { scroller: ".gallery-view", steps: 150 }),
    );
    return { frames, cells: await page.locator(".g-cell").count() };
  },
  async generate(page) {
    await page.goto(BASE);
    await page.locator(".prompt-input .cm-content").waitFor({ state: "visible" });
    await page.getByLabel("Prompts per run").fill("50");
    const gen = page.getByRole("button", { name: "Generate prompt" });
    for (let i = 0; i < MAX_LOAD.prompts / 50; i++) await gen.click();
    await page
      .locator("ul.prompts > li")
      .nth(MAX_LOAD.prompts - 1)
      .waitFor({ timeout: 60_000 });
    const frames = await withTrace(page, "generate", () =>
      scrollAndSampleFrames(page, { scroller: ".home .main-col", steps: 150 }),
    );
    return { frames, rows: await page.locator("li.prompt-result").count() };
  },
  async manage(page) {
    writePerfList("perf-harness-profile.txt", bigListText(MAX_LOAD.manageLines));
    try {
      await page.goto(BASE);
      await page.getByRole("tab", { name: "Manage" }).click();
      await page.locator(".mg-sidebar .picker-filter").fill("perf-harness-profile");
      await page.locator(".mg-pill", { hasText: "perf-harness-profile" }).first().click();
      await page.locator(".mg-rows .mg-row").first().waitFor({ state: "visible" });
      const frames = await withTrace(page, "manage", () =>
        scrollAndSampleFrames(page, { scroller: ".mg-rows", steps: 150 }),
      );
      return { frames, rows: await page.locator(".mg-row").count() };
    } finally {
      removePerfList("perf-harness-profile.txt");
    }
  },
};

async function main() {
  const pick = process.argv.slice(2);
  const names = pick.length ? pick : Object.keys(scenarios);
  fs.mkdirSync(OUT, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
  const summary = { generatedAt: new Date().toISOString(), maxLoad: MAX_LOAD, scenarios: {} };
  try {
    for (const name of names) {
      if (!scenarios[name]) {
        console.warn(`unknown scenario: ${name}`);
        continue;
      }
      const page = await browser.newPage();
      console.log(`\n▶ profiling: ${name}`);
      const t0 = Date.now();
      const detail = await scenarios[name](page);
      const m = await metrics(page);
      summary.scenarios[name] = { ms: Date.now() - t0, ...detail, metrics: m };
      console.log(
        `  frames median=${detail.frames.median}ms p95=${detail.frames.p95}ms max=${detail.frames.max}ms long=${detail.frames.long} | heap=${m.heapMB}MB nodes=${m.nodes} layouts=${m.layoutCount}`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
    await server.stop();
  }
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\n✓ wrote ${path.relative(ROOT, path.join(OUT, "summary.json"))} + per-scenario traces`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
