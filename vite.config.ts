import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
  },
  build: {
    // Vite 8 uses Rolldown. Keep app code separate from stable vendor code,
    // and cap vendor chunk targets without suppressing the size warning.
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 16_000,
          maxSize: 180_000,
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)([\\/]|$)/,
              priority: 30,
            },
            {
              name: "supabase-vendor",
              test: /node_modules[\\/]@supabase[\\/]/,
              minSize: 16_000,
              maxSize: 180_000,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              minSize: 16_000,
              maxSize: 180_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
