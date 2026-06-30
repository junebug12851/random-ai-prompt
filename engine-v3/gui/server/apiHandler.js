/**
 * The local `/api/*` request handler — the LOCAL backend for the app: hosted-generation proxy,
 * local-file image storage + gallery feed, ImageMagick convert/resize, content-management (Manage),
 * a file-watch SSE, and the local-file settings store.
 *
 * Extracted from `vite-plugin-api.js` so the SAME handler backs BOTH the Vite **dev** server
 * (`configureServer`) AND the standalone **release** server (`server/serve.js`). This is the fix for
 * the dev-build-as-release defect: a real production build now has the identical backend the dev
 * server has, instead of the dev server being the only thing with a working API. There is one
 * implementation, so the two transports can never drift.
 *
 * The handler is transport-agnostic: it takes Node's `(req, res, next)` (the connect/Vite shape),
 * matches a route or calls `next()` to fall through (to Vite's next middleware in dev, or to static
 * file serving in the release server).
 * @module gui/server/apiHandler
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { dispatch, dispatchRewrite, dispatchUpscale } from "./dispatch.js";
import {
  resolveManagePath,
  buildManageSnapshot,
  buildManageTree,
  writeFileAtomic,
  mergeSidecar,
  setMarker,
  fsOp,
  restoreFromRepo,
  remoteManifest,
  MANAGE_ROOTS,
} from "./manageFs.js";
import {
  OUTPUT_DIR,
  USER_DIR,
  IMAGE_TYPES,
  detectMagick,
  resolveOutputFile,
  readJson,
  send,
  readNs,
  writeNs,
  removeNs,
  listNs,
  migrateLegacyStore,
} from "../vite-api-helpers.js";

const execP = promisify(exec);

/**
 * Run one-time startup migrations (fold any legacy flat `.gui-storage.json` into the per-namespace
 * user-settings folder). Idempotent and best-effort. Call once when a server boots.
 * @returns {void}
 */
export function runStartupMigrations() {
  migrateLegacyStore();
}

/**
 * The directories whose changes the `/api/manage/watch` SSE reports. The two prompt-content roots
 * (lists + dynamic-prompts) drive a live catalog refresh; the output folder drives a gallery
 * refresh; the user-settings folder drives a settings reload. Each is optional — a missing folder is
 * simply not watched (the client's manual refresh still works).
 * @returns {Array<{ scope: string, dir: string, recursive: boolean }>}
 */
function watchTargets() {
  return [
    ...Object.values(MANAGE_ROOTS).map((dir) => ({ scope: "data", dir, recursive: true })),
    { scope: "output", dir: OUTPUT_DIR, recursive: false },
    { scope: "settings", dir: USER_DIR, recursive: true },
  ];
}

/**
 * Build the `/api/*` request handler.
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: Function) => Promise<void>}
 */
export function createApiHandler() {
  return async (req, res, next) => {
    if (!req.url) return next();
    const u = new URL(req.url, "http://localhost");

    // --- Hosted generation proxy ---
    if (u.pathname === "/api/generate" && req.method === "POST") {
      const body = await readJson(req);
      const { providerId, prompt, key, params } = body;
      if (!prompt) return send(res, 400, { error: "Missing prompt" });
      if (!key) return send(res, 400, { error: "Missing API key" });
      try {
        const out = await dispatch({ providerId, prompt, key, params });
        return send(res, 200, out);
      } catch (e) {
        return send(res, 502, { error: e.message || "Generation failed" });
      }
    }

    // --- AI-upscale proxy (for hosted providers the browser can't call directly, e.g. Replicate) ---
    // Inlines the local source image as a data URI (the upstream can't reach our localhost
    // output folder), runs the provider's upscale-server adapter, then fetches the result(s)
    // server-side (no browser CORS) and returns them as data URLs so the output folder saves them.
    if (u.pathname === "/api/upscale" && req.method === "POST") {
      const body = await readJson(req);
      const { providerId, image, key, params } = body || {};
      if (!providerId || !key) return send(res, 400, { error: "Missing providerId or key" });
      let imageDataUri;
      if (typeof image === "string" && image.startsWith("data:")) {
        imageDataUri = image;
      } else {
        const fp = resolveOutputFile(image);
        if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Source image not found" });
        const ext = path.extname(fp).slice(1).toLowerCase() || "png";
        imageDataUri = `data:${IMAGE_TYPES[ext] || "image/png"};base64,${fs.readFileSync(fp).toString("base64")}`;
      }
      try {
        const { images } = await dispatchUpscale({ providerId, image: imageDataUri, key, params });
        const out = [];
        for (const src of images || []) {
          if (typeof src !== "string") continue;
          if (src.startsWith("data:")) {
            out.push(src);
            continue;
          }
          try {
            const up = await fetch(src);
            if (!up.ok) continue;
            const ct = (up.headers.get("content-type") || "image/png").split(";")[0];
            const buf = Buffer.from(await up.arrayBuffer());
            out.push(`data:${ct};base64,${buf.toString("base64")}`);
          } catch {
            // skip a result we couldn't fetch back
          }
        }
        if (!out.length) return send(res, 502, { error: "Upscale produced no image" });
        return send(res, 200, { images: out });
      } catch (e) {
        return send(res, 502, { error: e.message || "Upscale failed" });
      }
    }

    // --- prompt rewrite (auto-fix / keyword-translate) proxy ---
    if (u.pathname === "/api/rewrite" && req.method === "POST") {
      const body = await readJson(req);
      const { providerId, prompt, key, mode } = body;
      if (!prompt) return send(res, 400, { error: "Missing prompt" });
      try {
        const out = await dispatchRewrite({ providerId, prompt, key, mode });
        return send(res, 200, out);
      } catch (e) {
        return send(res, 502, { error: e.message || "Rewrite failed" });
      }
    }

    // --- local-direct forward proxy (avoids CORS for ComfyUI / A1111 etc.) ---
    // The browser can't call a local server that sends no CORS headers (Comfy Desktop,
    // default A1111). Forward the call server-side. Restricted to localhost to avoid an
    // open proxy.
    if (u.pathname === "/api/forward" && req.method === "POST") {
      const body = await readJson(req);
      const target = body?.url;
      let host = "";
      try {
        host = new URL(target).hostname;
      } catch {
        return send(res, 400, { error: "Invalid target URL" });
      }
      if (!["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(host)) {
        return send(res, 403, { error: "Forwarding is restricted to localhost" });
      }
      try {
        const init = { method: body.method || "GET" };
        if (body.body !== undefined) {
          init.headers = { "Content-Type": "application/json" };
          init.body = JSON.stringify(body.body);
        }
        const upstream = await fetch(target, init);
        const text = await upstream.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text || `Upstream returned ${upstream.status}` };
        }
        res.statusCode = upstream.ok ? 200 : upstream.status;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(data));
      } catch (e) {
        return send(res, 502, { error: `Could not reach ${target}: ${e.message}` });
      }
    }

    // --- ingest a generated image into the central output folder ---
    // Accepts { src } as a data: URL (decode) or a localhost URL (fetch server-side — also
    // sidesteps Comfy Desktop's 403 on the browser). Saves to engine-v3/output/ and returns
    // the served path. Any provider funnels its results through this for one shared folder.
    if (u.pathname === "/api/image" && req.method === "POST") {
      const body = await readJson(req);
      const src = body?.src;
      const meta = body?.meta && typeof body.meta === "object" ? body.meta : null;
      try {
        let buf;
        let ext = "png";
        const m = typeof src === "string" && src.match(/^data:([^;]+);base64,(.*)$/s);
        if (m) {
          ext = (m[1].split("/")[1] || "png").split("+")[0];
          buf = Buffer.from(m[2], "base64");
        } else {
          let host = "";
          try {
            host = new URL(src).hostname;
          } catch {
            return send(res, 400, { error: "Invalid image src" });
          }
          if (!["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(host)) {
            return send(res, 403, {
              error: "Image ingest is restricted to localhost / data URLs",
            });
          }
          const up = await fetch(src);
          if (!up.ok)
            return send(res, up.status, { error: `Image fetch failed (${up.status})` });
          ext = ((up.headers.get("content-type") || "image/png").split("/")[1] || "png").split(
            "+",
          )[0];
          buf = Buffer.from(await up.arrayBuffer());
        }
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        fs.writeFileSync(path.join(OUTPUT_DIR, name), buf);
        // Write the metadata sidecar next to the image — same base name, `.json` — so the
        // photo gallery can show how each image was made (prompt, DPL, AI translation,
        // provider + full settings snapshot). One image ↔ one sidecar, like the v1-2 feed.
        if (meta) {
          const sidecar = {
            ...meta,
            file: name,
            image: `/api/output/${name}`,
            savedAt: meta.savedAt || new Date().toISOString(),
          };
          try {
            fs.writeFileSync(
              path.join(OUTPUT_DIR, name.replace(/\.[^.]+$/, ".json")),
              JSON.stringify(sidecar, null, 2),
            );
          } catch {
            // best-effort: a missing sidecar just means less gallery detail, not a failure
          }
        }
        return send(res, 200, { path: `/api/output/${name}` });
      } catch (e) {
        return send(res, 502, { error: `Could not save image: ${e.message}` });
      }
    }

    // --- serve a saved image from the central output folder ---
    if (u.pathname.startsWith("/api/output/") && req.method === "GET") {
      const name = decodeURIComponent(u.pathname.slice("/api/output/".length));
      if (name.includes("/") || name.includes("\\") || name.includes("..")) {
        return send(res, 400, { error: "Invalid name" });
      }
      const fp = path.join(OUTPUT_DIR, name);
      if (!fs.existsSync(fp)) {
        res.statusCode = 404;
        return res.end();
      }
      const ext = path.extname(name).slice(1).toLowerCase();
      res.statusCode = 200;
      res.setHeader("Content-Type", IMAGE_TYPES[ext] || "application/octet-stream");
      return res.end(fs.readFileSync(fp));
    }

    // --- photo-gallery feed: every saved image paired with its `.json` sidecar ---
    // Scans the output folder, pairs each image with its same-base sidecar (parsed), and
    // returns the list newest-first. Inspired by the v1-2 feed's index over output/.
    // Returns an empty list when there's no folder yet (or nothing has been generated).
    if (u.pathname === "/api/feed" && req.method === "GET") {
      try {
        if (!fs.existsSync(OUTPUT_DIR)) return send(res, 200, { items: [] });
        const names = fs.readdirSync(OUTPUT_DIR);
        const items = [];
        for (const name of names) {
          const ext = path.extname(name).slice(1).toLowerCase();
          if (!IMAGE_TYPES[ext]) continue; // only images are gallery entries
          const base = name.replace(/\.[^.]+$/, "");
          const fp = path.join(OUTPUT_DIR, name);
          let meta = null;
          const sidecarPath = path.join(OUTPUT_DIR, `${base}.json`);
          if (fs.existsSync(sidecarPath)) {
            try {
              meta = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
            } catch {
              meta = null; // a corrupt sidecar shouldn't drop the image from the gallery
            }
          }
          let mtime = 0;
          try {
            mtime = fs.statSync(fp).mtimeMs;
          } catch {
            /* ignore */
          }
          items.push({ path: `/api/output/${name}`, file: name, name: base, mtime, meta });
        }
        // Newest first: prefer the sidecar's savedAt, fall back to the file mtime.
        items.sort((a, b) => {
          const ta = Date.parse(a.meta?.savedAt) || a.mtime;
          const tb = Date.parse(b.meta?.savedAt) || b.mtime;
          return tb - ta;
        });
        return send(res, 200, { items });
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }

    // --- ImageMagick capability probe (is it installed? which still formats can it write?) ---
    if (u.pathname === "/api/magick" && req.method === "GET") {
      const m = await detectMagick();
      return send(res, 200, { available: m.available, formats: m.formats });
    }

    // --- convert a saved image to another still format and stream it back as a download ---
    if (u.pathname === "/api/image/convert" && req.method === "GET") {
      const m = await detectMagick();
      if (!m.available) return send(res, 503, { error: "ImageMagick is not installed" });
      const format = (u.searchParams.get("format") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!m.formats.includes(format)) return send(res, 400, { error: "Unsupported format" });
      const inPath = resolveOutputFile(u.searchParams.get("file"));
      if (!inPath || !fs.existsSync(inPath)) return send(res, 404, { error: "Image not found" });
      const base = path.basename(inPath).replace(/\.[^.]+$/, "");
      const outPath = path.join(
        os.tmpdir(),
        `rap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`,
      );
      try {
        // `[0]` takes only the first frame, so the output is always a single still image.
        await execP(`${m.bin} "${inPath}[0]" "${outPath}"`, { timeout: 20000 });
        const buf = fs.readFileSync(outPath);
        fs.unlink(outPath, () => {});
        res.statusCode = 200;
        res.setHeader("Content-Type", IMAGE_TYPES[format] || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${base}.${format}"`);
        return res.end(buf);
      } catch (e) {
        try {
          if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        } catch {
          // ignore cleanup failure
        }
        return send(res, 502, { error: `Conversion failed: ${e.message}` });
      }
    }

    // --- resize a saved image by a factor (ImageMagick) into a NEW tracked output image ---
    // Downscale (factor < 1) or upscale (factor > 1); the result lands in the output folder as
    // its own gallery entry with a sidecar (parent link + `derivedKind: "resize"`), so it shows
    // up in the single view's Resizes strip like a re-roll / variation.
    if (u.pathname === "/api/image/resize" && req.method === "POST") {
      const m = await detectMagick();
      if (!m.available) return send(res, 503, { error: "ImageMagick is not installed" });
      const body = await readJson(req);
      const inPath = resolveOutputFile(body?.path);
      if (!inPath || !fs.existsSync(inPath)) return send(res, 404, { error: "Image not found" });
      const scale = Number(body?.scale);
      if (!(scale > 0) || scale > 8) return send(res, 400, { error: "Invalid scale (0–8)" });
      const ext = (path.extname(inPath).slice(1).toLowerCase() || "png").replace(/[^a-z0-9]/g, "");
      const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const outPath = path.join(OUTPUT_DIR, name);
      const pct = Math.round(scale * 100);
      try {
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        // `[0]` flattens to the first frame; `-resize N%` up/down-samples by the factor.
        await execP(`${m.bin} "${inPath}[0]" -resize ${pct}% "${outPath}"`, { timeout: 30000 });
      } catch (e) {
        try {
          if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        } catch {
          // ignore cleanup failure
        }
        return send(res, 502, { error: `Resize failed: ${e.message}` });
      }
      const meta = body?.meta && typeof body.meta === "object" ? body.meta : null;
      if (meta) {
        try {
          fs.writeFileSync(
            path.join(OUTPUT_DIR, name.replace(/\.[^.]+$/, ".json")),
            JSON.stringify(
              { ...meta, file: name, image: `/api/output/${name}`, savedAt: meta.savedAt || new Date().toISOString() },
              null,
              2,
            ),
          );
        } catch {
          // best-effort sidecar — a missing one just means less gallery detail
        }
      }
      return send(res, 200, { path: `/api/output/${name}` });
    }

    // --- image file actions (delete from disk / reveal in Explorer / open with default app) ---
    if (u.pathname === "/api/image/delete" && req.method === "POST") {
      const fp = resolveOutputFile((await readJson(req))?.path);
      if (!fp) return send(res, 400, { error: "Invalid path" });
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        // Remove the metadata sidecar alongside the image, if present.
        const sidecar = fp.replace(/\.[^.]+$/, ".json");
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
        return send(res, 200, { ok: true });
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }
    if (u.pathname === "/api/image/reveal" && req.method === "POST") {
      const fp = resolveOutputFile((await readJson(req))?.path);
      if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Not found" });
      // explorer /select returns a non-zero exit code even on success — ignore it.
      exec(`explorer /select,"${fp}"`);
      return send(res, 200, { ok: true });
    }
    if (u.pathname === "/api/image/open" && req.method === "POST") {
      const fp = resolveOutputFile((await readJson(req))?.path);
      if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Not found" });
      exec(`cmd /c start "" "${fp}"`); // open in the OS default program
      return send(res, 200, { ok: true });
    }

    // --- patch an image's metadata sidecar (e.g. save an edited keyword list) ---
    // Shallow-merges `patch` into the image's `<base>.json` sidecar and returns the merged
    // sidecar. Creates the sidecar if the image never had one. Used by the single view's
    // "rebuild keywords" action to persist its alphabetized keyword set over the prompt's.
    if (u.pathname === "/api/image/meta" && req.method === "POST") {
      const body = await readJson(req);
      const fp = resolveOutputFile(body?.path);
      if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Image not found" });
      const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
      if (!patch) return send(res, 400, { error: "Missing patch object" });
      const sidecarPath = fp.replace(/\.[^.]+$/, ".json");
      let meta = {};
      if (fs.existsSync(sidecarPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(sidecarPath, "utf8")) || {};
        } catch {
          meta = {}; // a corrupt sidecar is replaced rather than blocking the save
        }
      }
      const merged = { ...meta, ...patch };
      try {
        fs.writeFileSync(sidecarPath, JSON.stringify(merged, null, 2));
        return send(res, 200, { ok: true, meta: merged });
      } catch (e) {
        return send(res, 502, { error: `Could not write sidecar: ${e.message}` });
      }
    }

    // --- Manage: capability probe (presence ⇒ local mode, so the tab unlocks) ---
    if (u.pathname === "/api/manage/ping" && req.method === "GET") {
      return send(res, 200, { ok: true });
    }

    // --- Manage: full disk snapshot for the runtime loader ---
    if (u.pathname === "/api/manage/snapshot" && req.method === "GET") {
      try {
        return send(res, 200, buildManageSnapshot());
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }

    // --- Manage: the raw folder tree of both data roots ---
    if (u.pathname === "/api/manage/tree" && req.method === "GET") {
      try {
        return send(res, 200, {
          lists: buildManageTree(MANAGE_ROOTS.lists),
          "dynamic-prompts": buildManageTree(MANAGE_ROOTS["dynamic-prompts"]),
        });
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }

    // --- Manage: read one file's text ---
    if (u.pathname === "/api/manage/file" && req.method === "GET") {
      const abs = resolveManagePath(u.searchParams.get("root"), u.searchParams.get("path"));
      if (!abs) return send(res, 400, { error: "Invalid path" });
      if (!fs.existsSync(abs)) return send(res, 404, { error: "Not found" });
      try {
        return send(res, 200, { text: fs.readFileSync(abs, "utf8") });
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }

    // --- Manage: write one file's text (atomic) ---
    if (u.pathname === "/api/manage/file" && req.method === "POST") {
      const body = await readJson(req);
      const abs = resolveManagePath(body?.root, body?.path);
      if (!abs) return send(res, 400, { error: "Invalid path" });
      if (typeof body?.text !== "string") return send(res, 400, { error: "Missing text" });
      try {
        writeFileAtomic(abs, body.text);
        return send(res, 200, { ok: true, root: body.root, path: body.path });
      } catch (e) {
        return send(res, 502, { error: `Could not write file: ${e.message}` });
      }
    }

    // --- Manage: merge a `<name>.json` sidecar (description / priority / nsfw / forceList…) ---
    if (u.pathname === "/api/manage/sidecar" && req.method === "POST") {
      const body = await readJson(req);
      if (!body?.patch || typeof body.patch !== "object")
        return send(res, 400, { error: "Missing patch" });
      const merged = mergeSidecar(body.root, body.name, body.patch);
      if (merged === null) return send(res, 400, { error: "Invalid path" });
      return send(res, 200, { ok: true, meta: merged });
    }

    // --- Manage: toggle a folder marker (force-prefix / group enable|disable) ---
    if (u.pathname === "/api/manage/marker" && req.method === "POST") {
      const body = await readJson(req);
      const ok = setMarker(body?.root, body?.dir ?? "", body?.marker, !!body?.on);
      return ok ? send(res, 200, { ok: true }) : send(res, 400, { error: "Invalid marker/path" });
    }

    // --- Manage: filesystem ops (mkdir / mkfile / delete / move) ---
    if (u.pathname === "/api/manage/fs" && req.method === "POST") {
      const body = await readJson(req);
      const out = fsOp(body?.op, body);
      return out.ok ? send(res, 200, { ok: true }) : send(res, 400, { error: out.error });
    }

    // --- Manage: watch the data roots + output + settings, push change events (auto-refresh) ---
    // One SSE stream tags each event with a `scope` ("data" | "output" | "settings") so the client
    // can react precisely: refresh the live catalog, the gallery feed, or re-read settings.
    if (u.pathname === "/api/manage/watch" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      // Debounce per scope so a burst of file events collapses into one client refresh.
      const timers = {};
      const emit = (scope) => {
        clearTimeout(timers[scope]);
        timers[scope] = setTimeout(
          () => res.write(`event: ${scope}\ndata: ${Date.now()}\n\n`),
          200,
        );
      };
      const watchers = [];
      for (const { scope, dir, recursive } of watchTargets()) {
        try {
          if (!fs.existsSync(dir)) continue;
          watchers.push(fs.watch(dir, { recursive }, () => emit(scope)));
        } catch {
          /* watch unsupported here — the client's manual Refresh still works */
        }
      }
      const keep = setInterval(() => res.write(": keep\n\n"), 30000);
      req.on("close", () => {
        clearInterval(keep);
        for (const t of Object.values(timers)) clearTimeout(t);
        watchers.forEach((w) => w.close());
      });
      return; // keep the connection open
    }

    // --- Manage: the stable-branch file manifest (for ghost / restorable entries) ---
    if (u.pathname === "/api/manage/remote-manifest" && req.method === "GET") {
      try {
        const m = await remoteManifest(u.searchParams.get("fresh") === "1");
        return send(res, 200, m);
      } catch (e) {
        return send(res, 502, { error: e.message });
      }
    }

    // --- Manage: restore a file to its repo default (main) ---
    if (u.pathname === "/api/manage/restore" && req.method === "POST") {
      const body = await readJson(req);
      const out = await restoreFromRepo(body?.root, body?.path);
      return out.ok
        ? send(res, 200, { ok: true, deleted: out.deleted || false })
        : send(res, 502, { error: out.error });
    }

    // --- Local-file storage tier (one user-settings folder, one file per namespace) ---
    if (u.pathname === "/api/storage") {
      if (req.method === "GET" && u.searchParams.get("keys")) {
        return send(res, 200, { keys: listNs() });
      }
      const ns = u.searchParams.get("ns");
      if (req.method === "GET") return send(res, 200, { value: readNs(ns) ?? null });
      if (req.method === "PUT") {
        const body = await readJson(req);
        if (!writeNs(ns, body?.value)) return send(res, 400, { error: "Invalid namespace" });
        return send(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        removeNs(ns);
        return send(res, 200, { ok: true });
      }
    }

    return next();
  };
}
