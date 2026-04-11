import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["seeso"],
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
