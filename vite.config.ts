import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    cssMinify: "lightningcss",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (!normalized.includes("/node_modules/")) {
            return undefined;
          }
          if (
            normalized.includes("/node_modules/three/") ||
            normalized.includes("/node_modules/three-stdlib/")
          ) {
            return "three";
          }
          if (
            normalized.includes("/node_modules/@react-three/") ||
            normalized.includes("/node_modules/postprocessing/") ||
            normalized.includes("/node_modules/n8ao/") ||
            normalized.includes("/node_modules/maath/")
          ) {
            return "r3f";
          }
          if (
            normalized.includes("/node_modules/react/") ||
            normalized.includes("/node_modules/react-dom/") ||
            normalized.includes("/node_modules/react-router/") ||
            normalized.includes("/node_modules/react-router-dom/") ||
            normalized.includes("/node_modules/scheduler/")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
});
