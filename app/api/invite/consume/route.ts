import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  getSessionCookieName,
  verifyInviteToken,
} from "@/lib/auth/tokens";
import { DEFAULT_HOSPITAL_ID, HOSPITAL_COOKIE_NAME } from "@/lib/auth/hospitalScope";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=token_missing", req.url));
  }

  const invite = verifyInviteToken(token);
  if (!invite) {
    return NextResponse.redirect(new URL("/login?error=token_invalid", req.url));
  }

  const sessionToken = createSessionToken({
    role: invite.role,
    hospitalId: invite.hospitalId ?? DEFAULT_HOSPITAL_ID,
    patientId: invite.patientId,
    patientName: invite.patientName,
    ttlSec: 60 * 60 * 8,
  });
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  cookieStore.set(HOSPITAL_COOKIE_NAME, invite.hospitalId ?? DEFAULT_HOSPITAL_ID, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  const redirectPath = invite.role === "patient" ? "/" : "/dashboard/family";
  return NextResponse.redirect(new URL(redirectPath, req.url));
}
