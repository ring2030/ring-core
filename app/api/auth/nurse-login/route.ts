import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/tokens";

type LoginBody = {
  passcode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const expected = process.env.NURSE_LOGIN_PASSCODE?.trim() || "ring-nurse";
    if (!body.passcode || body.passcode !== expected) {
      return NextResponse.json(
        { ok: false, error: "パスコードが違います。" },
        { status: 401 },
      );
    }

    const token = createSessionToken({ role: "nurse" });
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ログイン処理に失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
