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
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [titleTapCount, setTitleTapCount] = useState(0);
  const [showShoheiEasterEgg, setShowShoheiEasterEgg] = useState(false);

  function onNurseTitleClick() {
    setTitleTapCount((count) => {
      const next = count + 1;
      if (next >= 3) {
        setShowShoheiEasterEgg((visible) => !visible);
        return 0;
      }
      return next;
    });
  }

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
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        errorCode?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Sign-in failed.");
        setShowPasswordReset(json.errorCode === "PASSWORD_CHANGE_REQUIRED");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handlePasswordReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetPending(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, currentPassword: password, newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setResetMessage(json.error ?? "Could not change password.");
        return;
      }
      setResetMessage("Password updated. Sign in again with the new password.");
      setPassword(newPassword);
      setNewPassword("");
      setShowPasswordReset(false);
    } finally {
      setResetPending(false);
    }
  }

  function goWithToken() {
    if (!inviteToken.trim()) {
      setError("Enter an invite token.");
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
          <h1 className="text-2xl font-black select-none" onClick={onNurseTitleClick}>
            Staff sign-in
          </h1>
          <p className="mt-2 text-sm text-slate-300">Sign in to open the care dashboard.</p>
          {showShoheiEasterEgg && (
            <p className="mt-2 text-xs tracking-wide text-cyan-300">MVP mode: cheering #17.</p>
          )}
          <form className="mt-6 space-y-4" onSubmit={handleNurseLogin}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Login ID</span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-cyan-400 focus:ring"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Password</span>
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
              {pending ? "Signing in…" : "Continue as staff"}
            </button>
          </form>
          <div className="mt-5 text-xs text-slate-400">
            Demo account: ID <code>1</code> / password <code>1</code>.
          </div>
          {showPasswordReset && (
            <form className="mt-4 space-y-3 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3" onSubmit={handlePasswordReset}>
              <p className="text-xs text-amber-100">
                Security policy requires setting a new password before sign-in.
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none ring-cyan-400 focus:ring"
                placeholder="New password (10+ chars)"
              />
              <button
                type="submit"
                disabled={resetPending}
                className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60"
              >
                {resetPending ? "Updating…" : "Update password"}
              </button>
              {resetMessage && <p className="text-xs text-amber-100">{resetMessage}</p>}
            </form>
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h2 className="text-2xl font-black">Family & patient invite</h2>
          <p className="mt-2 text-sm text-slate-300">
            Open an invite link you received, or paste the token below.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Invite token</span>
              <textarea
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 outline-none ring-cyan-400 focus:ring"
                placeholder="Full URL or paste token only"
              />
            </label>
            <button
              type="button"
              onClick={goWithToken}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950"
            >
              Continue with token
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-400">
            If you paste a URL, you can trim to the part after <code className="text-slate-300">token=</code>.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-cyan-300 underline">
            Home
          </Link>
        </section>
      </div>

      {(error || initialErrorCode) && (
        <div className="mx-auto mt-6 w-full max-w-4xl rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error ??
            (initialErrorCode === "token_invalid"
              ? "Invite token is invalid or expired."
              : "Invite token is missing.")}
        </div>
      )}
    </main>
  );
}
