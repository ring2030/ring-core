import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/tokens";
import {
  getNurseRoleForHospital,
  hasPasswordChangeRequirement,
  listHospitalsForNurse,
  verifyNurseCredentials,
} from "@/lib/auth/nurseAccounts";
import {
  HOSPITAL_COOKIE_NAME,
  resolveHospitalIdForNurse,
  resolveHospitalIdsForNurseFromStaticMap,
} from "@/lib/auth/hospitalScope";
import { appendAuditEvent } from "@/lib/audit/auditLog";
import {
  clearLoginFailures,
  getLoginLockRemainingSec,
  recordLoginFailure,
} from "@/lib/auth/loginSecurity";

type LoginBody = {
  loginId?: string;
  password?: string;
  hospitalId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const loginId = String(body.loginId ?? "").trim();
    const password = String(body.password ?? "");
    if (!loginId || !password) {
      return NextResponse.json(
        { ok: false, error: "Enter login ID and password.", errorCode: "MISSING_CREDENTIALS" },
        { status: 401 },
      );
    }
    const lockRemainingSec = await getLoginLockRemainingSec(loginId);
    if (lockRemainingSec > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Account locked. Try again in about ${Math.ceil(lockRemainingSec / 60)} min.`,
          errorCode: "ACCOUNT_LOCKED",
          lockRemainingSec,
        },
        { status: 423 },
      );
    }
    const ok = await verifyNurseCredentials(loginId, password);
    if (!ok) {
      const lockResult = await recordLoginFailure(loginId);
      return NextResponse.json(
        lockResult.locked
          ? {
              ok: false,
              error: "Too many failed attempts. Account locked for 15 minutes.",
              errorCode: "ACCOUNT_LOCKED",
              lockRemainingSec: lockResult.remainingSec,
            }
          : { ok: false, error: "Invalid login ID or password.", errorCode: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }
    await clearLoginFailures(loginId);
    const mustChangePassword = await hasPasswordChangeRequirement(loginId, password);
    if (mustChangePassword) {
      return NextResponse.json(
        {
          ok: false,
          error: "Password update required before sign-in. Enter a new password below.",
          errorCode: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 403 },
      );
    }

    const fromAccounts = await listHospitalsForNurse(loginId, password);
    const fallback = resolveHospitalIdsForNurseFromStaticMap(loginId);
    const hospitalIds = fromAccounts.length > 0 ? fromAccounts : fallback;
    const requestedHospitalId = String(body.hospitalId ?? "").trim();
    const hospitalId =
      (requestedHospitalId && hospitalIds.includes(requestedHospitalId)
        ? requestedHospitalId
        : hospitalIds[0]) ?? resolveHospitalIdForNurse(loginId);
    const nurseRole = (await getNurseRoleForHospital(loginId, password, hospitalId)) ?? "nurse";
    const token = createSessionToken({
      role: "nurse",
      nurseId: loginId,
      nurseRole,
      hospitalId,
      hospitalIds,
    });
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    cookieStore.set(HOSPITAL_COOKIE_NAME, hospitalId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId,
      actorId: loginId,
      actorRole: "nurse",
      action: "auth.login",
      target: "session",
    });

    return NextResponse.json({ ok: true, nurseId: loginId, nurseRole, hospitalId, hospitalIds });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
