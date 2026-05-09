import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { validateEnv } from "./lib/validateEnv";

/** Turbopack は Windows の絶対パス alias を未対応のため相対パスで渡す */
const mediapipeFaceMeshShim = "./lib/mediapipe-face-mesh-shim.ts";
const mediapipeFaceDetectionShim = "./lib/mediapipe-face-detection-shim.ts";

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
      "@mediapipe/face_detection": mediapipeFaceDetectionShim,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@mediapipe/face_mesh": path.join(process.cwd(), "lib/mediapipe-face-mesh-shim.ts"),
      "@mediapipe/face_detection": path.join(process.cwd(), "lib/mediapipe-face-detection-shim.ts"),
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
      {
        source: "/:path*.binarypb",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
        ],
      },
      {
        source: "/:path*.tflite",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
        ],
      },
    ];
  },
};

const sentryOrg = process.env["SENTRY_ORG"]?.trim();
const sentryProject = process.env["SENTRY_PROJECT"]?.trim();
const sentryAuthToken = process.env["SENTRY_AUTH_TOKEN"]?.trim();

export default withSentryConfig(nextConfig, {
  // Keep source maps hidden from public bundles while still uploading.
  sourcemaps: {
    disable: !sentryAuthToken,
  },
  ...(sentryOrg ? { org: sentryOrg } : {}),
  ...(sentryProject ? { project: sentryProject } : {}),
  ...(sentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: true,
});
