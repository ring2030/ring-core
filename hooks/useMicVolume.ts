"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Microphone RMS-volume hook.
 *
 * Returns a 0–1 normalized loudness value updated at the browser's animation
 * frame rate. While `enabled` is false the hook releases the mic stream and
 * audio context, so the browser's "tab is using your mic" indicator stays
 * accurate to the conversation state.
 *
 * Powering the lantern's `listening` animation: 0–1 → scale 1.0–1.3 etc.
 */
export function useMicVolume(enabled: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Defer the reset so we don't trip React 19's "setState in effect" lint.
      void Promise.resolve().then(() => {
        if (mountedRef.current) setLevel(0);
      });
      return;
    }
    if (typeof window === "undefined") return;

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let cancelled = false;
    // Buffer is allocated against a fresh ArrayBuffer so the Web Audio
    // `getFloatTimeDomainData` typings (Float32Array<ArrayBuffer>) are happy.
    let buf: Float32Array<ArrayBuffer> | null = null;

    type WindowWithLegacyAudio = Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const w = window as WindowWithLegacyAudio;
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      return;
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled || !stream) return;
        audioCtx = new Ctor();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        buf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

        const tick = () => {
          if (cancelled || !analyser || !buf) return;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = buf[i] ?? 0;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          // Map RMS (~0.0–0.3 in normal speech) into 0–1 with a gentle curve.
          const norm = Math.max(0, Math.min(1, rms * 4.5));
          if (mountedRef.current) setLevel(norm);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        // Permission denied or no device — silently degrade to 0.
        console.warn("[useMicVolume] mic unavailable:", err);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        analyser?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      try {
        void audioCtx?.close();
      } catch {
        /* ignore */
      }
      stream = null;
      audioCtx = null;
      analyser = null;
      buf = null;
      setLevel(0);
    };
  }, [enabled]);

  return level;
}
