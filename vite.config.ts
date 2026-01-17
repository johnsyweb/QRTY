import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  base: "/QRTY/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
