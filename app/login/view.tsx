"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  nextPath: string;
  initialErrorCode: string | null;
};

export function LoginClient({ nextPath, initialErrorCode }: Props) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNurseLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/nurse-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "ログインに失敗しました。");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function goWithToken() {
    if (!inviteToken.trim()) {
      setError("招待トークンを入力してください。");
      return;
    }
    const raw = inviteToken.trim();
    let token = raw;
    if (raw.includes("token=")) {
      try {
        const url = new URL(raw);
        token = url.searchParams.get("token") ?? raw;
      } catch {
        const split = raw.split("token=");
        token = split[1]?.split("&")[0] ?? raw;
      }
    }
    router.push(`/api/invite/consume?token=${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h1 className="text-2xl font-black">看護師ログイン</h1>
          <p className="mt-2 text-sm text-slate-300">看護師ダッシュボードに入るための画面です。</p>
          <form className="mt-6 space-y-4" onSubmit={handleNurseLogin}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">ログインID</span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-cyan-400 focus:ring"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">パスワード</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-cyan-400 focus:ring"
                autoComplete="current-password"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-60"
            >
              {pending ? "ログイン中..." : "看護師として入る"}
            </button>
          </form>
          <div className="mt-5 text-xs text-slate-400">
            初期アカウントは ID: <code>1</code> / パスワード: <code>1</code> です。
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">家族・患者 招待URL</h2>
          <p className="mt-2 text-sm text-slate-300">
            受け取った招待URLを開くか、トークンを貼り付けて入室できます。
          </p>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">招待トークン</span>
              <textarea
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-cyan-400 focus:ring"
                placeholder="URL全体または token を貼り付け"
              />
            </label>
            <button
              type="button"
              onClick={goWithToken}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950"
            >
              招待トークンで入る
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-400">
            URLを貼る場合は `token=` 以降だけ残して入力してください。
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-cyan-300 underline">
            ホームへ戻る
          </Link>
        </section>
      </div>

      {(error || initialErrorCode) && (
        <div className="mx-auto mt-6 w-full max-w-4xl rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error ??
            (initialErrorCode === "token_invalid"
              ? "招待トークンが無効か期限切れです。"
              : "招待トークンが見つかりません。")}
        </div>
      )}
    </main>
  );
}
