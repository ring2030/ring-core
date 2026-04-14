import type { DocumentData, Timestamp } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";

export type CallReason = "トイレ" | "お話" | string;
export type SenderRole = "patient" | "family" | "nurse" | "system";

export type CallRecord = {
  id: string;
  reasons: string[];
  note: string;
  senderName: string;
  senderRole: SenderRole;
  createdAt: Date;
  priority: number;
  aiSummary: string;
};

type BuildPayloadInput = {
  reasons: string[];
  note?: string;
  senderName?: string;
  senderRole?: SenderRole;
  priority?: number;
  aiSummary?: string;
  transcript?: string;
};

function parseReasons(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function toTimestampDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function buildCallWritePayload(input: BuildPayloadInput): Record<string, unknown> {
  const reasons = input.reasons.filter(Boolean);
  const note = input.note ?? "";
  const senderName = input.senderName ?? "患者";
  const senderRole = input.senderRole ?? "patient";
  const priority = input.priority ?? 1;
  const aiSummary = input.aiSummary ?? "";

  return {
    reasonCodes: reasons,
    note,
    senderName,
    senderRole,
    createdAt: serverTimestamp(),
    priority,
    aiSummary,
    ...(input.transcript ? { transcript: input.transcript } : {}),

    // Legacy fields kept for compatibility during migration.
    理由: reasons,
    特記事項: note,
    送信者: senderName,
    送信日時: serverTimestamp(),
    緊急度: priority,
    要約: aiSummary,
    ...(input.transcript ? { 認識文: input.transcript } : {}),
  };
}

export function normalizeCallDoc(id: string, raw: DocumentData): CallRecord {
  const reasons = parseReasons(raw.reasonCodes ?? raw.理由);
  const note = String(raw.note ?? raw.特記事項 ?? "");
  const senderName = String(raw.senderName ?? raw.送信者 ?? "不明");
  const senderRole = String(raw.senderRole ?? "patient") as SenderRole;
  const createdAt =
    toTimestampDate(raw.createdAt) ??
    toTimestampDate(raw.送信日時) ??
    toTimestampDate(raw.時間) ??
    new Date();
  const priorityValue = Number(raw.priority ?? raw.緊急度 ?? 1);
  const priority = Number.isFinite(priorityValue) ? priorityValue : 1;
  const aiSummary = String(raw.aiSummary ?? raw.要約 ?? "");

  return {
    id,
    reasons: reasons.length > 0 ? reasons : ["不明"],
    note,
    senderName,
    senderRole,
    createdAt,
    priority,
    aiSummary,
  };
}
