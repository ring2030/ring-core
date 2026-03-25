/**
 * 家族→お年寄りの動画レター等に使う Firestore コレクション名。
 * プロトタイプの `messages_${userId}` に相当する単一チャネル版。
 */
export function getVideoMessagesCollection(): string {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION?.trim() || "messages"
    );
  }
  return process.env.NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION?.trim() || "messages";
}
