/**
 * Shared demo call generation for:
 * - GET /api/dev/seed-demo (manual, SEED_DEMO_SECRET)
 * - GET /api/cron/refresh-demo-calls (Vercel Cron + CRON_SECRET)
 *
 * Only documents carrying these tags are touched by cron / clean —
 * real tablet writes without seedTag are never deleted.
 */
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_HOSPITAL_ID, getCallsCollectionNameForHospital } from "@/lib/auth/hospitalScope";
import { DEMO_SEED_TAG } from "@/lib/demo/demoSeedTags";
import {
  planDemoEntries,
  type Scenario,
  utcRotationDay,
} from "@/lib/demo/demoScenarioPlanner";

export const BATCH_SIZE = 450;
export type { Scenario };
export { planDemoEntries, utcRotationDay };

export type PendingDemoWrite = {
  ref: DocumentReference;
  data: Record<string, unknown>;
};

export function getDemoHospitalId(): string {
  return process.env["DEMO_HOSPITAL_ID"]?.trim() || DEFAULT_HOSPITAL_ID;
}

export function getDemoCallsCollectionName(): string {
  return getCallsCollectionNameForHospital(getDemoHospitalId());
}

function appendDemoWrite(
  pending: PendingDemoWrite[],
  db: Firestore,
  collectionName: string,
  ts: Date,
  senderName: string,
  scenario: Scenario,
  seedTag: string,
  hospitalId: string,
): void {
  const [reason, transcript, note, summary, priority] = scenario;
  const tri = transcript.trim();
  pending.push({
    ref: db.collection(collectionName).doc(),
    data: {
      reasonCodes: [reason],
      note,
      senderName,
      senderRole: "patient",
      createdAt: Timestamp.fromDate(ts),
      priority,
      aiSummary: summary,
      ...(tri ? { transcript: tri } : {}),
      理由: reason,
      特記事項: note,
      送信者: senderName,
      送信日時: Timestamp.fromDate(ts),
      ステータス: "未対応",
      要約: summary,
      緊急度: priority,
      認識文: tri,
      seedTag,
      hospitalId,
    },
  });
}

export function buildPendingAdminDemoWrites(
  db: Firestore,
  collectionName: string,
  now: Date,
  rotationDay: number,
  seedTag: string = DEMO_SEED_TAG,
): PendingDemoWrite[] {
  const pending: PendingDemoWrite[] = [];
  const hospitalId = getDemoHospitalId();
  for (const { at, scenario, senderName } of planDemoEntries(now, rotationDay)) {
    appendDemoWrite(pending, db, collectionName, at, senderName, scenario, seedTag, hospitalId);
  }
  return pending;
}

export async function deleteDemoCallsByTags(
  db: Firestore,
  collectionName: string,
  tags: readonly string[],
): Promise<number> {
  let removed = 0;
  for (const tag of tags) {
    const snap = await db.collection(collectionName).where("seedTag", "==", tag).get();
    const refs = snap.docs.map((d) => d.ref);
    for (let s = 0; s < refs.length; s += BATCH_SIZE) {
      const b = db.batch();
      for (const r of refs.slice(s, s + BATCH_SIZE)) b.delete(r);
      await b.commit();
    }
    removed += refs.length;
  }
  return removed;
}

export async function commitPendingWrites(
  db: Firestore,
  pending: PendingDemoWrite[],
): Promise<void> {
  for (let s = 0; s < pending.length; s += BATCH_SIZE) {
    const b = db.batch();
    for (const p of pending.slice(s, s + BATCH_SIZE)) b.set(p.ref, p.data);
    await b.commit();
  }
}

export function summarizeWeekdays(pending: PendingDemoWrite[]): Record<string, number> {
  const weekdayCounts: Record<string, number> = {};
  for (const p of pending) {
    const ca = p.data["createdAt"] as Timestamp | undefined;
    if (ca && typeof ca.toDate === "function") {
      const d = ca.toDate();
      const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? "?";
      weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1;
    }
  }
  return weekdayCounts;
}

export function perResidentCounts(pending: PendingDemoWrite[]): Record<string, number> {
  const perResident: Record<string, number> = {};
  for (const p of pending) {
    const name = String(p.data["senderName"] ?? "");
    perResident[name] = (perResident[name] ?? 0) + 1;
  }
  return perResident;
}
