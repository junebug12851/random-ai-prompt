import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain Vite + React SPA. Builds to dist/ as static files (deployed to Netlify).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
