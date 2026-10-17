import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds the demo app (not the library) for deployment, e.g. GitHub Pages.
// The default config builds the `lib/` package instead.
export default defineConfig({
  base: "/useInfiniteScroll/",
  plugins: [react()],
  build: {
    outDir: "dist-demo",
    copyPublicDir: false,
  },
});
