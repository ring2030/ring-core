import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import { listAuditEvents } from "@/lib/audit/auditLog";

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!session || session.role !== "nurse" || !session.hospitalId) {
    return new Response("Staff sign-in required.", { status: 401 });
  }
  const events = await listAuditEvents(session.hospitalId, 1000);
  const header = ["at", "hospitalId", "actorId", "actorRole", "action", "target", "note"].join(",");
  const lines = events.map((event) =>
    [
      event.at,
      event.hospitalId,
      event.actorId,
      event.actorRole,
      event.action,
      event.target,
      event.note ?? "",
    ]
      .map((v) => escapeCsv(String(v)))
      .join(","),
  );
  const csv = [header, ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${session.hospitalId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

