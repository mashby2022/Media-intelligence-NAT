import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || "http://127.0.0.1:8000";
const apiProxyPrefixes = [
  "/autonomous-intake",
  "/config",
  "/datasets",
  "/demo",
  "/dispatch",
  "/frontend-contract",
  "/generate-brief",
  "/health",
  "/interactive-workspace",
  "/knowledge",
  "/launch",
  "/market-signals",
  "/miranda",
  "/models",
  "/network-graph",
  "/orchestrator",
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "ec2-100-56-10-190.compute-1.amazonaws.com",
      "ec2-100-56-10-190.compute-1.amazonaws.com:8080",
      ".brevlab.com",
    ],
    hmr: {
      overlay: false,
    },
    proxy: Object.fromEntries(
      apiProxyPrefixes.map((prefix) => [
        prefix,
        {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      ]),
    ),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          vendor: ["@tanstack/react-query", "lucide-react"],
          pdf: ["pdf-lib"],
        },
      },
    },
  },
}));
