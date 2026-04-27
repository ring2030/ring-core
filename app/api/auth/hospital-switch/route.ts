import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import { HOSPITAL_COOKIE_NAME } from "@/lib/auth/hospitalScope";
import { appendAuditEvent } from "@/lib/audit/auditLog";
import { getNurseRoleByIdAndHospital } from "@/lib/auth/nurseAccounts";

type SwitchBody = {
  hospitalId?: string;
};

async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getSessionCookieName())?.value;
  return raw ? verifySessionToken(raw) : null;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "nurse" || !session.hospitalId) {
    return NextResponse.json({ ok: false, error: "Staff sign-in required." }, { status: 401 });
  }
  const hospitalIds =
    Array.isArray(session.hospitalIds) && session.hospitalIds.length > 0
      ? session.hospitalIds
      : [session.hospitalId];
  return NextResponse.json({ ok: true, hospitalId: session.hospitalId, hospitalIds });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "nurse" || !session.hospitalId) {
      return NextResponse.json({ ok: false, error: "Staff sign-in required." }, { status: 401 });
    }
    const hospitalIds =
      Array.isArray(session.hospitalIds) && session.hospitalIds.length > 0
        ? session.hospitalIds
        : [session.hospitalId];
    const body = (await req.json()) as SwitchBody;
    const target = String(body.hospitalId ?? "").trim();
    if (!target || !hospitalIds.includes(target)) {
      return NextResponse.json(
        { ok: false, error: "You are not assigned to that hospital." },
        { status: 400 },
      );
    }
    const token = createSessionToken({
      role: "nurse",
      nurseId: session.nurseId,
      nurseRole:
        (await getNurseRoleByIdAndHospital(session.nurseId ?? "", target)) ?? session.nurseRole,
      hospitalId: target,
      hospitalIds,
      ttlSec: 60 * 60 * 12,
    });
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    cookieStore.set(HOSPITAL_COOKIE_NAME, target, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId: target,
      actorId: session.nurseId ?? "unknown",
      actorRole: "nurse",
      action: "hospital.switch",
      target,
    });
    return NextResponse.json({ ok: true, hospitalId: target, hospitalIds });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not switch hospital.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

