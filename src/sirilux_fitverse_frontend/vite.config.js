import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import environment from "vite-plugin-environment";
import { VitePWA } from "vite-plugin-pwa";

dotenv.config({ path: "../../.env" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Sirilux Fitverse",
        short_name: "Sirilux Fitverse",
        description: "Access, Analyze, and Amplify your fitness journey",
        theme_color: "#367ed1",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "assets/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            urlPattern: new RegExp("^https://api."),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
    }),
  ],
  build: {
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ["date-fns", "pdfjs-dist/build/pdf.worker.mjs"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target:
          process.env.DFX_NETWORK === "local"
            ? `http://127.0.0.1:4943`
            : "https://ic0.app/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
  define: {
    "process.env.DFX_NETWORK": JSON.stringify(process.env.DFX_NETWORK),
    "process.env.CANISTER_ID_INTERNET_IDENTITY": JSON.stringify(
      process.env.CANISTER_ID_INTERNET_IDENTITY
    ),
    "process.env.CANISTER_ID_USER": JSON.stringify(
      process.env.CANISTER_ID_USER
    ),
    "process.env.CANISTER_ID_PROFESSIONAL": JSON.stringify(
      process.env.CANISTER_ID_PROFESSIONAL
    ),
    "process.env.CANISTER_ID_FACILITY": JSON.stringify(
      process.env.CANISTER_ID_FACILITY
    ),
    "process.env.CANISTER_ID_DATAASSET": JSON.stringify(
      process.env.CANISTER_ID_DATAASSET
    ),
    "process.env.CANISTER_ID_IDENTITY_MANAGER": JSON.stringify(
      process.env.CANISTER_ID_IDENTITY_MANAGER
    ),

    "process.env.CANISTER_ID_GAMIFICATIONSYSTEM": JSON.stringify(
      process.env.CANISTER_ID_GAMIFICATIONSYSTEM
    ),
    "process.env.CANISTER_ID_VISITMANAGER": JSON.stringify(
      process.env.CANISTER_ID_VISITMANAGER
    ),
    "process.env.CANISTER_ID_TOKEN": JSON.stringify(
      process.env.CANISTER_ID_ICRC_LEDGER_CANISTER
    ),
    "process.env.CANISTER_ID_ICRC_INDEX_CANISTER": JSON.stringify(
      process.env.CANISTER_ID_ICRC_INDEX_CANISTER
    ),
    "process.env.CANISTER_ID_SUBSCRIPTION_MANAGER": JSON.stringify(
      process.env.CANISTER_ID_SUBSCRIPTION_MANAGER
    ),
    "process.env.CANISTER_ID_AIAGENTSYSTEM": JSON.stringify(
      process.env.CANISTER_ID_AIAGENTSYSTEM
    ),
    "process.env.II_URL": JSON.stringify(
      process.env.DFX_NETWORK === "local"
        ? `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943/`
        : "https://identity.ic0.app/"
    ),

    "process.env.RAZORPAY_KEY_ID": JSON.stringify(process.env.RAZORPAY_KEY_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
