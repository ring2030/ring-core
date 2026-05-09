import { promises as fs } from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";

export type AuditActorRole = "nurse" | "family" | "patient" | "system";

export type AuditEvent = {
  at: string;
  hospitalId: string;
  actorId: string;
  actorRole: AuditActorRole;
  action: string;
  target: string;
  note?: string;
};

const VALID_ACTOR_ROLES: ReadonlySet<AuditActorRole> = new Set([
  "nurse",
  "family",
  "patient",
  "system",
]);

const STORE_DIR =
  process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]
    ? "/tmp/.ring-data"
    : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "audit-log.jsonl");
const AUDIT_COLLECTION =
  process.env["AUDIT_LOGS_COLLECTION"]?.trim() || "audit_logs";

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AuditEvent>;
  if (
    typeof v.at !== "string" ||
    typeof v.hospitalId !== "string" ||
    typeof v.actorId !== "string" ||
    typeof v.action !== "string" ||
    typeof v.target !== "string"
  ) {
    return false;
  }
  if (typeof v.actorRole !== "string" || !VALID_ACTOR_ROLES.has(v.actorRole as AuditActorRole)) {
    return false;
  }
  if (v.note !== undefined && typeof v.note !== "string") {
    return false;
  }
  return true;
}

type AuditLogEntry = {
  msg: string;
  op: "audit_write" | "audit_read";
  outcome: "success" | "fallback" | "error";
  hospitalId?: string;
  errorCode?: string;
  errorName?: string;
};

function structuredLog(level: "warn" | "error", entry: AuditLogEntry): void {
  const line = JSON.stringify({ level, scope: "audit", ...entry });
  if (level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}

function describeError(error: unknown): { name: string; code: string } {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; code?: unknown };
    const name = typeof e.name === "string" ? e.name : "Error";
    const code = typeof e.code === "string" ? e.code : "unknown";
    return { name, code };
  }
  return { name: "Error", code: "unknown" };
}

async function appendAuditEventToFile(event: AuditEvent): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.appendFile(STORE_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

async function listAuditEventsFromFile(
  hospitalId: string,
  limit: number,
): Promise<AuditEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(STORE_FILE, "utf8");
  } catch {
    return [];
  }
  const events: AuditEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!isAuditEvent(parsed)) continue;
      if (parsed.hospitalId !== hospitalId) continue;
      events.push(parsed);
    } catch {
      // Skip a single corrupt line; do not abort the whole read.
      continue;
    }
  }
  return events.slice(-limit).reverse();
}

export async function appendAuditEvent(event: AuditEvent): Promise<void> {
  if (!isAuditEvent(event)) {
    throw new Error("Invalid audit event payload");
  }
  try {
    const db = getFirebaseAdminDb();
    await db.collection(AUDIT_COLLECTION).add(event);
    return;
  } catch (error) {
    const { name, code } = describeError(error);
    if (isProduction()) {
      structuredLog("error", {
        msg: "Firestore audit write failed; refusing to fall back in production",
        op: "audit_write",
        outcome: "error",
        hospitalId: event.hospitalId,
        errorName: name,
        errorCode: code,
      });
      Sentry.captureException(error, {
        tags: { scope: "audit", op: "audit_write" },
        extra: { hospitalId: event.hospitalId, errorCode: code },
      });
      throw error;
    }
    structuredLog("warn", {
      msg: "Firestore audit write failed; using file fallback (non-production)",
      op: "audit_write",
      outcome: "fallback",
      hospitalId: event.hospitalId,
      errorName: name,
      errorCode: code,
    });
  }
  await appendAuditEventToFile(event);
}

export async function listAuditEvents(
  hospitalId: string,
  limit = 100,
): Promise<AuditEvent[]> {
  try {
    const db = getFirebaseAdminDb();
    const snapshot = await db
      .collection(AUDIT_COLLECTION)
      .where("hospitalId", "==", hospitalId)
      .orderBy("at", "desc")
      .limit(limit)
      .get();
    const events: AuditEvent[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (isAuditEvent(data)) events.push(data);
    });
    return events;
  } catch (error) {
    const { name, code } = describeError(error);
    if (isProduction()) {
      structuredLog("error", {
        msg: "Firestore audit read failed; refusing to fall back in production",
        op: "audit_read",
        outcome: "error",
        hospitalId,
        errorName: name,
        errorCode: code,
      });
      Sentry.captureException(error, {
        tags: { scope: "audit", op: "audit_read" },
        extra: { hospitalId, errorCode: code },
      });
      throw error;
    }
    structuredLog("warn", {
      msg: "Firestore audit read failed; using file fallback (non-production)",
      op: "audit_read",
      outcome: "fallback",
      hospitalId,
      errorName: name,
      errorCode: code,
    });
    return listAuditEventsFromFile(hospitalId, limit);
  }
}
