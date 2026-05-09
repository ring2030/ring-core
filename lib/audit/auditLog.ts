import { promises as fs } from "node:fs";
import path from "node:path";

export type AuditEvent = {
  at: string;
  hospitalId: string;
  actorId: string;
  actorRole: "nurse" | "family" | "patient" | "system";
  action: string;
  target: string;
  note?: string;
};

const STORE_DIR = process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]
  ? "/tmp/.ring-data"
  : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "audit-log.jsonl");

export async function appendAuditEvent(event: AuditEvent): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.appendFile(STORE_FILE, `${JSON.stringify(event)}\n`, "utf8");
}

export async function listAuditEvents(hospitalId: string, limit = 100): Promise<AuditEvent[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const events = lines
      .map((line) => JSON.parse(line) as AuditEvent)
      .filter((event) => event.hospitalId === hospitalId)
      .slice(-limit)
      .reverse();
    return events;
  } catch {
    return [];
  }
}

