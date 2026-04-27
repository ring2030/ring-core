import { NextResponse } from "next/server";
import { changePasswordWithCurrent, listHospitalsForNurse } from "@/lib/auth/nurseAccounts";
import { clearLoginFailures } from "@/lib/auth/loginSecurity";
import { appendAuditEvent } from "@/lib/audit/auditLog";

type Body = {
  loginId?: string;
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const loginId = String(body.loginId ?? "").trim();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!loginId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: "Login ID, current password, and new password are required." },
        { status: 400 },
      );
    }
    await changePasswordWithCurrent({ id: loginId, currentPassword, newPassword });
    await clearLoginFailures(loginId);
    const hospitals = await listHospitalsForNurse(loginId, newPassword);
    await Promise.all(
      hospitals.map((hospitalId) =>
        appendAuditEvent({
          at: new Date().toISOString(),
          hospitalId,
          actorId: loginId,
          actorRole: "nurse",
          action: "auth.password_change",
          target: "session",
        }),
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Password change failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

