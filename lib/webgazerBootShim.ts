/**
 * Runs before `webgazer.js` (Next.js Script strategy="beforeInteractive").
 * - Adds tfjs URL flags so the bundled TensorFlow.js prefers lighter WebGL paths.
 * - Wraps canvas getContext for WebGL with conservative attributes + webgl2→webgl fallback.
 *
 * MediaPipe Face Mesh still needs a WebGL context for video textures; this does not remove it.
 */
export const WEBGAZER_BOOT_SHIM = `(function(){
  try {
    if (typeof window === "undefined" || typeof history === "undefined" || typeof location === "undefined") return;
    var u;
    try { u = new URL(location.href); } catch (e) { return; }
    if (!u.searchParams.has("tfjsflags")) {
      u.searchParams.set(
        "tfjsflags",
        "WEBGL_CPU_FORWARD:true,WEBGL_PACK:false,WEBGL_FLUSH_THRESHOLD:-1"
      );
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof window === "undefined" || window.__kiyokoWebGlGetContextPatched) return;
    window.__kiyokoWebGlGetContextPatched = true;
    var proto = HTMLCanvasElement.prototype;
    var orig = proto.getContext;
    window.__kiyokoOrigGetContext = orig;
    proto.getContext = function (type, attrs) {
      var glTypes = { webgl: 1, webgl2: 1, "experimental-webgl": 1 };
      if (!glTypes[type]) {
        return orig.call(this, type, attrs);
      }
      var merged = Object.assign(
        {},
        attrs || {},
        {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: false,
        }
      );
      try {
        var ctx = orig.call(this, type, merged);
        if (!ctx && type === "webgl2") {
          ctx = orig.call(this, "webgl", merged) || orig.call(this, "experimental-webgl", merged);
        }
        return ctx;
      } catch (err) {
        return null;
      }
    };
  } catch (e2) { /* ignore */ }
})();`;
