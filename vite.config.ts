import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    // Disable cartographer plugin temporarily due to @babel/traverse issues
    // ...(process.env.NODE_ENV !== "production" &&
    // process.env.REPL_ID !== undefined
    //   ? [
    //       await import("@replit/vite-plugin-cartographer").then((m) =>
    //         m.cartographer(),
    //       ),
    //     ]
    //   : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  optimizeDeps: {
    exclude: ['@hookform/resolvers']
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || '5000'}`,
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || '5000'}`,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || '5000'}`,
        changeOrigin: true,
        ws: true,
      }
    },
    host: '0.0.0.0',
    allowedHosts: [
      '6fd9977a-b952-43d5-bf27-5fd0af5e6cf9-00-11igruttx3ot0.janeway.replit.dev',
      'a71c2612-4708-447f-8122-efa444745754-00-ylvr7i9x5iwa.kirk.replit.dev',
      '.replit.dev'
    ],
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client", "public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
