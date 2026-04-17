import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createInviteToken,
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/tokens";

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

    const body = (await req.json()) as InviteBody;
    const role = body.role === "patient" ? "patient" : "family";
    const expiresInMinutes = Math.min(Math.max(body.expiresInMinutes ?? 180, 10), 24 * 60);

    const token = createInviteToken({
      role,
      patientId: body.patientId?.trim(),
      patientName: body.patientName?.trim(),
      ttlSec: expiresInMinutes * 60,
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
