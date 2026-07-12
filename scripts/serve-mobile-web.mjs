/**
 * @file
 * @brief Static server for the mobile target's react-native-web export (`targets/mobile/dist`).
 *
 * The mobile app has no dev server of its own that Playwright can drive, and `expo start --web`
 * is a long-lived bundler (wrong shape for a `webServer` command). So the E2E suite runs against the
 * *exported* bundle — the same artifact the visual-parity harness shoots — served statically here.
 *
 * Run: `node scripts/serve-mobile-web.mjs [--port 8100]`
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "targets/mobile/dist");
const portArg = process.argv.indexOf("--port");
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 8100;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".ico": "image/x-icon",
};

if (!existsSync(OUT)) {
  console.error(`✗ ${OUT} missing — build it first: npm --prefix targets/mobile run export:web`);
  process.exit(1);
}

createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    reqPath = "/";
  }
  // Path-traversal sanitizer: normalize, strip leading `../` segments, then join under OUT.
  const safe = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = join(OUT, safe);
  try {
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(OUT, "index.html");
  } catch {
    file = join(OUT, "index.html");
  }
  try {
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`mobile web export served at http://localhost:${PORT}`));
