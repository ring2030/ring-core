import type { Firestore } from "firebase-admin/firestore";
import { normalizeReasonList } from "@/lib/calls/reasons";
import type { AggregatableCall } from "@/lib/phil/schema";

const CALLS_COLLECTION = "calls";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") {
      const d = maybe.toDate();
      return Number.isFinite(d.getTime()) ? d : null;
    }
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

/**
 * Strip raw call documents down to the minimal, non-identifying shape the
 * PHIL aggregator needs. PII fields (senderName, transcript, summary) are
 * NEVER read here — we only pull priority, reasons, timestamp, and hospital
 * id (used for counting unique hospitals, never published).
 */
export async function readAggregatableCallsForUtcDay(
  db: Firestore,
  utcDay: Date,
  collectionName: string = CALLS_COLLECTION,
): Promise<AggregatableCall[]> {
  const start = new Date(
    Date.UTC(
      utcDay.getUTCFullYear(),
      utcDay.getUTCMonth(),
      utcDay.getUTCDate(),
    ),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const snap = await db
    .collection(collectionName)
    .where("createdAt", ">=", start)
    .where("createdAt", "<", end)
    .get();

  const out: AggregatableCall[] = [];
  for (const doc of snap.docs) {
    const raw = doc.data() as Record<string, unknown>;
    const createdAt =
      parseDate(raw["createdAt"]) ??
      parseDate(raw["送信日時"]) ??
      parseDate(raw["時間"]);
    if (!createdAt) continue;

    const priorityRaw = Number(raw["priority"] ?? raw["緊急度"] ?? 1);
    const priority = Number.isFinite(priorityRaw) ? priorityRaw : 1;

    const reasonsRawCandidate =
      raw["reasonCodes"] ?? raw["理由"] ?? [];
    let reasonsRaw: string[];
    if (Array.isArray(reasonsRawCandidate)) {
      reasonsRaw = reasonsRawCandidate.map((v) => String(v));
    } else if (typeof reasonsRawCandidate === "string") {
      reasonsRaw = [reasonsRawCandidate];
    } else {
      reasonsRaw = [];
    }
    const reasons = normalizeReasonList(reasonsRaw.filter((r) => r.trim()));

    const hospitalId =
      typeof raw["hospitalId"] === "string" ? raw["hospitalId"] : undefined;
    const responseTimeSec =
      typeof raw["responseTimeSec"] === "number" &&
      Number.isFinite(raw["responseTimeSec"])
        ? raw["responseTimeSec"]
        : undefined;

    out.push({
      createdAt,
      priority,
      reasons,
      ...(hospitalId !== undefined ? { hospitalId } : {}),
      ...(responseTimeSec !== undefined ? { responseTimeSec } : {}),
    });
  }

  return out;
}
