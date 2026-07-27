import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("three")) {
            return "vendor-three";
          }
          if (id.includes("pixi.js") || id.includes("@pixi")) {
            return "vendor-pixi";
          }
          if (id.includes("firebase") || id.includes("@firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }

          return "vendor";
        },
      },
    },
  },
});
