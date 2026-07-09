/**
 * @file Create the in-project link to the shared engine: targets/mobile/engine -> ../../engine.
 * Metro (React Native) resolves poorly across the monorepo boundary (the repo root is an ESM package),
 * so the mobile target links the engine IN so all resolution stays inside the project root. Idempotent.
 * Uses a Windows "junction" (no admin needed) / a dir symlink elsewhere. Run: npm run link:engine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const link = path.resolve(here, "..", "engine");
const target = path.resolve(here, "..", "..", "..", "engine");

try {
  const st = fs.lstatSync(link);
  if (st.isSymbolicLink() || st.isDirectory()) fs.rmSync(link, { recursive: true, force: true });
} catch { /* not present */ }

fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
console.log(`linked ${path.relative(process.cwd(), link)} -> ${target}`);