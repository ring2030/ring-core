import type { Firestore as AdminFirestore } from "firebase-admin/firestore";
import type { PhilAggregate } from "@/lib/phil/schema";

const MAX_PAGE = 366;

function isPhilAggregate(value: unknown): value is PhilAggregate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["date"] === "string" &&
    typeof v["sample_size"] === "number" &&
    typeof v["schema_version"] === "string"
  );
}

export async function fetchAggregateRangeAdmin(
  db: AdminFirestore,
  opts: { from?: string; to?: string; limitN?: number },
): Promise<PhilAggregate[]> {
  const lim = Math.min(Math.max(opts.limitN ?? 90, 1), MAX_PAGE);
  let q = db.collection("phil_aggregates").orderBy("date", "desc") as
    | FirebaseFirestore.Query
    | FirebaseFirestore.CollectionReference;
  if (opts.from) q = q.where("date", ">=", opts.from);
  if (opts.to) q = q.where("date", "<=", opts.to);
  const snap = await q.limit(lim).get();
  const rows: PhilAggregate[] = [];
  for (const d of snap.docs) {
    const v = d.data();
    if (isPhilAggregate(v)) rows.push(v);
  }
  return rows;
}

export async function fetchAggregateByDateAdmin(
  db: AdminFirestore,
  date: string,
): Promise<PhilAggregate | null> {
  const snap = await db.collection("phil_aggregates").doc(date).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return isPhilAggregate(data) ? data : null;
}
