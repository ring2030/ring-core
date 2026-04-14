import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/tokens";
import { verifyNurseCredentials } from "@/lib/auth/nurseAccounts";

type LoginBody = {
  loginId?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const loginId = String(body.loginId ?? "").trim();
    const password = String(body.password ?? "");
    if (!loginId || !password) {
      return NextResponse.json(
        { ok: false, error: "IDとパスワードを入力してください。" },
        { status: 401 },
      );
    }
    const ok = await verifyNurseCredentials(loginId, password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "IDまたはパスワードが正しくありません。" },
        { status: 401 },
      );
    }

    const token = createSessionToken({ role: "nurse", nurseId: loginId });
    const cookieStore = await cookies();
    cookieStore.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({ ok: true, nurseId: loginId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "ログイン処理に失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
