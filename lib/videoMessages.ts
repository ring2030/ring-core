/**
 * Firestore collection name used for family video messages.
 * Prototype used messages_${userId}; current app uses single "messages" channel.
 */
export function getVideoMessagesCollection(): string {
  if (typeof window !== "undefined") {
    return (
      process.env["NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION"]?.trim() || "messages"
    );
  }
  return process.env["NEXT_PUBLIC_VIDEO_MESSAGES_COLLECTION"]?.trim() || "messages";
}
