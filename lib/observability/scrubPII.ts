const SENSITIVE_KEYS = [
  // Japanese field names from Firestore schema
  "送信者",
  "認識文",
  "要約",
  "特記事項",
  // English / common
  "sender",
  "patientName",
  "patient_name",
  "transcript",
  "summary",
  "videoUrl",
  "video_url",
  "videoURL",
  "email",
  "emailAddress",
  "password",
  "token",
  "sessionId",
  "session_id",
  "authorization",
  // Names that often carry PII
  "name",
  "fullName",
  "full_name",
] as const;

const REDACTED = "[REDACTED]";

/**
 * Recursively walks an object and replaces any value whose key
 * looks sensitive with [REDACTED]. Case-insensitive match.
 * Returns a new object; does not mutate the input.
 */
export function scrubPII(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(scrubPII);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((s) =>
      key.toLowerCase().includes(s.toLowerCase()),
    );
    out[key] = isSensitive ? REDACTED : scrubPII(value);
  }
  return out;
}

export function scrubBreadcrumbMessage(msg: string): string {
  let out = msg;
  out = out.replace(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email]");
  out = out.replace(/Bearer\s+[a-zA-Z0-9._-]+/g, "Bearer [token]");
  return out;
}

