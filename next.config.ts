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
      /**
       * Eyedid（seeso）は cdn.seeso.io から WASM + Worker を読み込み、
       * ブラウザの WebAssembly threads / SharedArrayBuffer に依存する。
       * COOP + COEP で「オリジン分離」を付与すると読み込み成功率が上がる（公式サンプルと同系）。
       * credentialless は require-corp より第三者埋め込みを壊しにくい。
       *
       * 付与はホーム（/）のみ。`/:path*` 全体に付けると /demo など不要なページまで
       * 分離コンテキストになり、拡張機能・社内プロキシ等で「ブロック」に見えることがある。
       * @see https://web.dev/coop-coep/
       */
      {
        source: "/",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
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
    ];
  },
};

export default nextConfig;
