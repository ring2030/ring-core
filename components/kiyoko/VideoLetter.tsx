"use client";

import { useEffect, useRef } from "react";

type VideoLetterProps = {
  isActive: boolean;
  onClose: () => void;
  videoSrc: string | null;
};

/**
 * フルスクリーンで動画を再生。再生終了時 or × 押下で閉じる。
 */
export function VideoLetter({ isActive, onClose, videoSrc }: VideoLetterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isActive || !videoRef.current || !videoSrc) return;
    const v = videoRef.current;
    v.currentTime = 0;
    void v.play().catch(() => {});
  }, [isActive, videoSrc]);

  if (!isActive || !videoSrc) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={videoSrc}
        className="h-full w-full object-contain"
        controls
        autoPlay
        playsInline
        onEnded={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 cursor-pointer text-5xl text-white transition hover:scale-110"
        aria-label="閉じる"
      >
        &times;
      </button>
    </div>
  );
}
