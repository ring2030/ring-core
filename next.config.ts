import path from "node:path";
import type { NextConfig } from "next";
import { validateEnv } from "./lib/validateEnv";

/** Turbopack は Windows の絶対パス alias を未対応のため相対パスで渡す */
const mediapipeFaceMeshShim = "./lib/mediapipe-face-mesh-shim.ts";

// Warn about missing env vars at server startup instead of silently failing mid-request.
// Only runs in Node (not in the browser bundle).
if (typeof window === "undefined") {
  validateEnv();
}

const nextConfig: NextConfig = {
  transpilePackages: ["seeso"],
  turbopack: {
    resolveAlias: {
      "@mediapipe/face_mesh": mediapipeFaceMeshShim,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@mediapipe/face_mesh": path.join(process.cwd(), "lib/mediapipe-face-mesh-shim.ts"),
    };
    return config;
  },
  async headers() {
    return [
      // COOP/COEP はEyedid(seeso)のSharedArrayBuffer用だったが、
      // crossOriginIsolatedコンテキストがMediaPipeのWebGL texImage2D(video)を
      // 無効化することが判明したため削除。Eyedidが必要になったら再検討。
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
        ],
      },
      {
        // WebAssembly files served from public/ must have the correct MIME type
        source: "/:path*.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
        ],
      },
      {
        // MediaPipe packed assets / model data files
        source: "/:path*.data",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
        ],
      },
    ];
  },
};

export default nextConfig;
