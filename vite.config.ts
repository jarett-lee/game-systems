import { resolve } from "node:path";
import { defineConfig } from "vite";

const site = resolve(import.meta.dirname, "site");

export default defineConfig({
  root: site,
  base: "./",
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(site, "index.html"),
        gridPlacement: resolve(site, "grid-placement/index.html"),
      },
    },
  },
});
