import { notFound } from "next/navigation";
import { getFirebaseAdminDb } from "@/lib/firebaseAdmin";
import { fetchAggregateByDateAdmin } from "@/lib/phil/fetchPublicAdmin";
import type { PhilAggregate } from "@/lib/phil/schema";
import { DayDetailClient } from "./DayDetailClient";

export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function InsightDayPage(props: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await props.params;
  if (!ISO_DATE_RE.test(date)) notFound();

  let data: PhilAggregate | null = null;
  try {
    const db = getFirebaseAdminDb();
    data = await fetchAggregateByDateAdmin(db, date);
  } catch {
    data = null;
  }

  return <DayDetailClient date={date} data={data} />;
}
