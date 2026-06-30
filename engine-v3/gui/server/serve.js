/**
 * The standalone **release** server for the local app. This is what end users run — a real, built
 * release of the SPA, not the Vite dev server. It serves the production bundle from `gui/dist/` as
 * static files (with an SPA fallback) AND mounts the exact same `/api/*` backend the dev server uses
 * (`server/apiHandler.js`), so generation, the gallery, Manage, local providers, and live file-watch
 * all work in the shipped build. One backend implementation, two transports — they can't drift.
 *
 * Run it via `npm start` (builds then serves) or `npm run serve` (serves a prebuilt `dist/`). The
 * port is `PORT` (default 4173); set `NO_OPEN=1` to skip opening the browser.
 * @module gui/server/serve
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createApiHandler, runStartupMigrations } from "./apiHandler.js";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

// Minimal static MIME map for the assets a Vite build emits (+ the self-hosted fonts and legal HTML).
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Send a file with its content type. Honours HEAD (headers only).
 * @param {import("node:http").ServerResponse} res The response.
 * @param {string} abs The absolute file path.
 * @param {string} method The request method.
 * @returns {void}
 */
function sendFile(res, abs, method) {
  const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  if (method === "HEAD") return res.end();
  res.end(fs.readFileSync(abs));
}

/**
 * Serve the built SPA: a real file when one matches (assets, fonts, /legal/*), else the SPA fallback
 * to index.html (client routing). Unknown `/api/*` paths 404 as JSON rather than falling back.
 * @param {import("node:http").IncomingMessage} req The request.
 * @param {import("node:http").ServerResponse} res The response.
 * @returns {void}
 */
function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname.startsWith("/api/")) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Not found" }));
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end();
  }
  const rel = pathname.replace(/^\/+/, "") || "index.html";
  const abs = path.resolve(distDir, rel);
  // Traversal guard: never serve outside dist/.
  if (abs !== distDir.replace(/[\\/]$/, "") && path.relative(distDir, abs).startsWith("..")) {
    res.statusCode = 403;
    return res.end();
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return sendFile(res, abs, req.method);
  // SPA fallback — every other path serves index.html (200), like the Netlify redirect.
  return sendFile(res, path.join(distDir, "index.html"), req.method);
}

/**
 * Open the default browser at the server URL (best-effort; skipped when NO_OPEN is set).
 * @param {string} url The URL to open.
 * @returns {void}
 */
function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd =
    process.platform === "win32"
      ? `cmd /c start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

/**
 * Boot the release server.
 * @returns {void}
 */
function main() {
  const indexHtml = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.error(
      `No build found at ${distDir}\nRun the build first:  npm run web:build   (or use  npm start  to build + serve).`,
    );
    process.exit(1);
  }
  runStartupMigrations();
  const apiHandler = createApiHandler();
  const server = http.createServer((req, res) => {
    // Try the API first; it calls next() (→ static) for anything it doesn't own.
    Promise.resolve(apiHandler(req, res, () => serveStatic(req, res))).catch((e) => {
      if (res.headersSent) return;
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: e?.message || "Server error" }));
    });
  });
  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Random AI Prompt — release build running at ${url}`);
    openBrowser(url);
  });
}

main();
