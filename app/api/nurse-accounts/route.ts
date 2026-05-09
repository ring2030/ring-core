import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import {
  addHospitalMembership,
  createNurseAccount,
  listNurseAccounts,
  updateNurseAccount,
} from "@/lib/auth/nurseAccounts";
import { appendAuditEvent } from "@/lib/audit/auditLog";

async function requireNurseAuth() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!session || session.role !== "nurse" || !session.hospitalId) {
    throw new Error("Staff sign-in required.");
  }
  return {
    ...session,
    hospitalId: session.hospitalId,
  };
}

async function requireHospitalAdmin() {
  const session = await requireNurseAuth();
  if (session.nurseRole !== "hospital_admin") {
    throw new Error("Hospital admin role is required.");
  }
  return session;
}

export async function GET() {
  try {
    const session = await requireNurseAuth();
    const accounts = await listNurseAccounts(session.hospitalId);
    return NextResponse.json({ ok: true, accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not load accounts.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

type CreateBody = {
  id?: string;
  password?: string;
  role?: "hospital_admin" | "nurse" | "viewer";
};

export async function POST(req: Request) {
  try {
    const session = await requireHospitalAdmin();
    const body = (await req.json()) as CreateBody;
    const id = String(body.id ?? "").trim();
    const password = String(body.password ?? "");
    const created = await createNurseAccount(id, password, session.hospitalId);
    if (body.role && body.role !== "nurse") {
      await updateNurseAccount({
        id: created.id,
        hospitalId: session.hospitalId,
        role: body.role,
        mustChangePassword: true,
      });
    }
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId: session.hospitalId,
      actorId: session.nurseId ?? "unknown",
      actorRole: "nurse",
      action: "nurse_account.create",
      target: `nurse:${created.id}`,
    });
    return NextResponse.json({ ok: true, account: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("role is required") ? 403 : 400 },
    );
  }
}

type PatchBody = {
  id?: string;
  disabled?: boolean;
  password?: string;
  assignHospitalId?: string;
  role?: "hospital_admin" | "nurse" | "viewer";
  mustChangePassword?: boolean;
};

export async function PATCH(req: Request) {
  try {
    const session = await requireHospitalAdmin();
    const body = (await req.json()) as PatchBody;
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID is required." }, { status: 400 });
    }
    if (session.nurseId === id && body.disabled === true) {
      return NextResponse.json(
        { ok: false, error: "You cannot disable your own account while signed in." },
        { status: 400 },
      );
    }
    const assignHospitalId = String(body.assignHospitalId ?? "").trim();
    if (assignHospitalId) {
      const createdMembership = await addHospitalMembership({
        id,
        fromHospitalId: session.hospitalId,
        toHospitalId: assignHospitalId,
      });
      await appendAuditEvent({
        at: new Date().toISOString(),
        hospitalId: session.hospitalId,
        actorId: session.nurseId ?? "unknown",
        actorRole: "nurse",
        action: "nurse_account.assign_hospital",
        target: `nurse:${id}`,
        note: `to=${assignHospitalId}`,
      });
      return NextResponse.json({ ok: true, account: createdMembership });
    }
    const updated = await updateNurseAccount({
      id,
      hospitalId: session.hospitalId,
      ...(typeof body.disabled === "boolean" ? { disabled: body.disabled } : {}),
      ...(typeof body.password === "string" ? { password: body.password } : {}),
      ...(typeof body.role === "string" ? { role: body.role } : {}),
      ...(typeof body.mustChangePassword === "boolean"
        ? { mustChangePassword: body.mustChangePassword }
        : {}),
    });
    await appendAuditEvent({
      at: new Date().toISOString(),
      hospitalId: session.hospitalId,
      actorId: session.nurseId ?? "unknown",
      actorRole: "nurse",
      action: "nurse_account.update",
      target: `nurse:${updated.id}`,
      note: typeof body.disabled === "boolean" ? `disabled=${String(body.disabled)}` : "password_update",
    });
    return NextResponse.json({ ok: true, account: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("role is required") ? 403 : 400 },
    );
  }
}
