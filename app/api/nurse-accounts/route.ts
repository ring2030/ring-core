import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import {
  createNurseAccount,
  listNurseAccounts,
  updateNurseAccount,
} from "@/lib/auth/nurseAccounts";

async function requireNurseAuth() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName())?.value;
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!session || session.role !== "nurse") {
    throw new Error("看護師ログインが必要です。");
  }
  return session;
}

export async function GET() {
  try {
    await requireNurseAuth();
    const accounts = await listNurseAccounts();
    return NextResponse.json({ ok: true, accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "取得に失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

type CreateBody = {
  id?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    await requireNurseAuth();
    const body = (await req.json()) as CreateBody;
    const id = String(body.id ?? "").trim();
    const password = String(body.password ?? "");
    const created = await createNurseAccount(id, password);
    return NextResponse.json({ ok: true, account: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "作成に失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

type PatchBody = {
  id?: string;
  disabled?: boolean;
  password?: string;
};

export async function PATCH(req: Request) {
  try {
    const session = await requireNurseAuth();
    const body = (await req.json()) as PatchBody;
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "IDは必須です。" }, { status: 400 });
    }
    if (session.nurseId === id && body.disabled === true) {
      return NextResponse.json(
        { ok: false, error: "ログイン中の自分を無効化できません。" },
        { status: 400 },
      );
    }
    const updated = await updateNurseAccount({
      id,
      disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
    });
    return NextResponse.json({ ok: true, account: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新に失敗しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
