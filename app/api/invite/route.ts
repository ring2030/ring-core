import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createInviteToken,
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/tokens";
import { appendAuditEvent } from "@/lib/audit/auditLog";

type InviteBody = {
  role?: "family" | "patient";
  patientId?: string;
  patientName?: string;
  expiresInMinutes?: number;
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getSessionCookieName())?.value;
    const session = sessionToken ? verifySessionToken(sessionToken) : null;
    if (!session || session.role !== "nurse") {
      return NextResponse.json(
        { ok: false, error: "Staff sign-in required." },
        { status: 401 },
      );
    }
    if (session.nurseRole !== "hospital_admin") {
      return NextResponse.json(
        { ok: false, error: "Hospital admin role is required to create invites." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as InviteBody;
    const role = body.role === "patient" ? "patient" : "family";
    const expiresInMinutes = Math.min(Math.max(body.expiresInMinutes ?? 180, 10), 24 * 60);
    if (!session.hospitalId) {
      return NextResponse.json(
        { ok: false, error: "Hospital scope is missing in your session." },
        { status: 400 },
      );
    }

    const token = createInviteToken({
      role,
      hospitalId: session.hospitalId,
      patientId: body.patientId?.trim(),
      patientName: body.patientName?.trim(),
      ttlSec: expiresInMinutes * 60,
    });
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId: session.hospitalId,
      actorId: session.nurseId ?? "unknown",
      actorRole: "nurse",
      action: "invite.create",
      target: role,
      note: `expires_in=${expiresInMinutes}m`,
    });

    return NextResponse.json({
      ok: true,
      token,
      expiresInMinutes,
      path: `/access?token=${encodeURIComponent(token)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not create invite link.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
