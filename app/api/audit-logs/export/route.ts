import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import { listAuditEvents } from "@/lib/audit/auditLog";

const EXPORT_MAX_ROWS = 5_000;

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getSessionCookieName())?.value;
    const session = sessionToken ? verifySessionToken(sessionToken) : null;
    if (!session || session.role !== "nurse" || !session.hospitalId) {
      return new Response("Staff sign-in required.", { status: 401 });
    }

    // Honour caller-supplied ?limit= but hard-cap at EXPORT_MAX_ROWS.
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const requestedLimit = rawLimit ? parseInt(rawLimit, 10) : EXPORT_MAX_ROWS;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, EXPORT_MAX_ROWS)
      : EXPORT_MAX_ROWS;

    const events = await listAuditEvents(session.hospitalId, limit);
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
        "X-Export-Row-Count": String(events.length),
        "X-Export-Max-Rows": String(EXPORT_MAX_ROWS),
      },
    });
  } catch (error: unknown) {
    Sentry.captureException(error, { tags: { scope: "audit", route: "GET /api/audit-logs/export" } });
    const message = error instanceof Error ? error.message : "Export failed.";
    return new Response(message, { status: 500 });
  }
}
