import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// API proxying is confined to browser tests; production configuration stays intact.
const proxy = { "/api": process.env.CAKE_BACKEND_URL ?? "http://127.0.0.1:5000" };
export default mergeConfig(base, defineConfig({
  server: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
}));
