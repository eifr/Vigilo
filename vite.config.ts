import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      },
      manifest: false,
      devOptions: {
        enabled: false,
      },
    }),
    {
      name: "remove-onnx-wasm",
      closeBundle() {
        const assetsDir = path.resolve(__dirname, 'dist/assets');
        if (fs.existsSync(assetsDir)) {
          fs.readdirSync(assetsDir).forEach((file: string) => {
            if (file.endsWith('.wasm')) {
              fs.unlinkSync(path.join(assetsDir, file));
            }
          });
        }
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  worker: {
    format: "es",
    plugins: () => [
      {
        name: "onnxruntime-web-worker",
        async transform(code, id) {
          if (id.includes("onnxruntime-web")) {
            return code.replace(/from\s+['"]onnxruntime-web['"]/g, `from 'onnxruntime-web/webgpu'`);
          }
        },
      }
    ],
  },
});
