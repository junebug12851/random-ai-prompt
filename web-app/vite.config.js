import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The SPA imports the shared prompt engine from repo-root core/ (which bundles
// the dynamic-prompts/ lists/ expansions/ data via import.meta.glob). Allow the
// dev server to read those files above the web-app root.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Plain Vite + React SPA. Builds to dist/ as static files (deployed to Netlify).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
});
