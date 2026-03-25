"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { getVideoMessagesCollection } from "@/lib/videoMessages";
import { VideoLetter } from "@/components/kiyoko/VideoLetter";

type ElderVideoLetterOverlayProps = {
  /** ナースコール送信中・キャリブレーション・スリープ中は再再生ボタンを隠す */
  suppressReplayUi?: boolean;
};

/**
 * 最新1件を購読。家族からの type:video が追加されたらフルスクリーン自動再生。
 * 最新の家族動画 URL を保持し、「家族のビデオを見る」で再再生可能。
 */
export function ElderVideoLetterOverlay({
  suppressReplayUi = false,
}: ElderVideoLetterOverlayProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [latestFamilyVideoUrl, setLatestFamilyVideoUrl] = useState<string | null>(
    null,
  );
  const isInitialLoad = useRef(true);
  const lastSeenTopDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    let db;
    try {
      db = getFirestoreDb();
    } catch {
      return;
    }

    const coll = getVideoMessagesCollection();
    console.log("[elder][video] subscribe:start", {
      collection: coll,
    });
    const q = query(
      collection(db, coll),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const topFamilyVideoDoc =
          snapshot.docs.find((d) => {
            const m = d.data() as {
              sender?: string;
              type?: string;
              content?: string;
            };
            return m.sender === "family" && m.type === "video" && !!m.content;
          }) ?? null;
        const topDocId = topFamilyVideoDoc?.id ?? null;
        console.log("[elder][video] snapshot", {
          size: snapshot.size,
          topDocId,
          lastSeenTopDocId: lastSeenTopDocIdRef.current,
          changes: snapshot.docChanges().map((c) => ({
            type: c.type,
            id: c.doc.id,
          })),
        });
        let latestUrl: string | null = null;
        if (topFamilyVideoDoc) {
          const msg = topFamilyVideoDoc.data() as {
            sender?: string;
            type?: string;
            content?: string;
          };
          if (msg.sender === "family" && msg.type === "video" && msg.content) {
            latestUrl = msg.content;
          }
        }
        setLatestFamilyVideoUrl(latestUrl);

        // 初回はベースラインだけ作って再生しない（過去データスキップ）
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
          lastSeenTopDocIdRef.current = topDocId;
          console.log("[elder][video] initial-load:done", {
            baselineTopDocId: topDocId,
            hasLatestFamilyVideo: !!latestUrl,
          });
          return;
        }

        // 2回目以降、トップドキュメントが変わったときだけ「新規到着」とみなす
        const isTopChanged =
          topDocId != null && topDocId !== lastSeenTopDocIdRef.current;
        if (!isTopChanged) {
          console.log("[elder][video] blocked:top-not-changed", {
            topDocId,
            lastSeenTopDocId: lastSeenTopDocIdRef.current,
          });
          return;
        }
        lastSeenTopDocIdRef.current = topDocId;

        if (latestUrl) {
          console.log("[elder][video] play:new-video", {
            id: topDocId,
          });
          setVideoUrl(latestUrl);
          setShowVideo(true);
        } else {
          console.log("[elder][video] blocked:top-changed-but-not-family-video", {
            id: topDocId,
          });
        }
      },
      (err) => {
        console.error("[elder][video] subscribe:error", err);
      },
    );

    return () => {
      console.log("[elder][video] subscribe:stop");
      unsub();
    };
  }, []);

  const handleClose = () => {
    setShowVideo(false);
    setVideoUrl(null);
  };

  const openReplay = () => {
    if (!latestFamilyVideoUrl) return;
    setVideoUrl(latestFamilyVideoUrl);
    setShowVideo(true);
  };

  const showReplayButton =
    !suppressReplayUi &&
    Boolean(latestFamilyVideoUrl) &&
    !showVideo;

  return (
    <>
      {showReplayButton && (
        <button
          type="button"
          onClick={openReplay}
          className="fixed bottom-6 left-6 z-[10002] max-w-[min(92vw,28rem)] rounded-3xl border-4 border-violet-400/80 bg-violet-600 px-8 py-6 text-left text-2xl font-black text-white shadow-2xl transition hover:bg-violet-500 active:scale-[0.98] sm:text-3xl"
        >
          <span className="mr-2 inline-block" aria-hidden>
            📹
          </span>
          家族のビデオを見る
        </button>
      )}
      <VideoLetter
        isActive={showVideo}
        onClose={handleClose}
        videoSrc={videoUrl}
      />
    </>
  );
}
