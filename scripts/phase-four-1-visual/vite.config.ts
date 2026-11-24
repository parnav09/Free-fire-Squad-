import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "scripts/phase-four-1-visual",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
  preview: { host: "127.0.0.1", port: 4181, strictPort: true },
});
