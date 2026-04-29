import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// For GitHub Pages, set BASE_PATH=/<repo-name>/ at build time, e.g.:
//   BASE_PATH=/alpen-ssz/ npm run build
// For Vercel / Netlify / a custom domain at the root, leave it unset.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  worker: {
    format: "es",
  },
});
