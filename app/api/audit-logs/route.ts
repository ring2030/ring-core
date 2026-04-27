import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import { listAuditEvents } from "@/lib/audit/auditLog";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getSessionCookieName())?.value;
    const session = sessionToken ? verifySessionToken(sessionToken) : null;
    if (!session || session.role !== "nurse" || !session.hospitalId) {
      return NextResponse.json({ ok: false, error: "Staff sign-in required." }, { status: 401 });
    }
    const events = await listAuditEvents(session.hospitalId, 80);
    return NextResponse.json({ ok: true, events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load audit logs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

