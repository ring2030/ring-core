import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import { HOSPITAL_COOKIE_NAME } from "@/lib/auth/hospitalScope";
import { appendAuditEvent } from "@/lib/audit/auditLog";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getSessionCookieName())?.value;
  const session = raw ? verifySessionToken(raw) : null;
  if (session?.hospitalId) {
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId: session.hospitalId,
      actorId: session.nurseId ?? session.patientName ?? "unknown",
      actorRole: session.role,
      action: "auth.logout",
      target: "session",
    });
  }
  cookieStore.delete(getSessionCookieName());
  cookieStore.delete(HOSPITAL_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
