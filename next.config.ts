import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["seeso"],
  async headers() {
    return [
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
