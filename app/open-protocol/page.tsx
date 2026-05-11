import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ring Open Protocol (ROP)",
  description:
    "Open specification and reusable core for gaze-assisted nurse-call experiences — rebuild for your language and culture.",
};

export default function OpenProtocolPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-100">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">
          ring goes open
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          ring Open Protocol (ROP)
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          ROP is a <strong>documented protocol</strong> plus a <strong>language-neutral TypeScript core</strong> (
          <code className="rounded bg-slate-900 px-1 py-0.5 text-amber-100">@ring-open/core</code>
          ) so teams worldwide can <strong>rebuild</strong> gaze-based communication aids for their own hospitals,
          hospices, and homes — not just translate strings.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>
            <strong>Not</strong> a medical device standard and <strong>not</strong> a diagnostic tool.
          </li>
          <li>
            Privacy & ethics <strong>floor</strong> baked into the spec (local camera processing, consent, audit).
          </li>
          <li>
            Conformance levels from MVP → AI triage + family → PHIL-style public insight.
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
          <a
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 font-medium text-white hover:border-amber-400/60"
            href="/api/spec/rop-1-0"
          >
            Read spec (raw Markdown)
          </a>
          <Link
            className="rounded-lg border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:border-amber-400/60"
            href="/insights/methodology"
          >
            PHIL methodology
          </Link>
          <Link
            className="rounded-lg border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:border-amber-400/60"
            href="/insights/ethics"
          >
            Ethics &amp; governance (PHIL)
          </Link>
        </div>
        <p className="mt-8 text-xs leading-relaxed text-slate-500">
          Spec &amp; docs in this repo: <code className="text-slate-400">docs/spec/ROP-1.0.md</code>, launch plan{" "}
          <code className="text-slate-400">docs/spec/ROP_LAUNCH_PLAN.md</code>, recipes under{" "}
          <code className="text-slate-400">recipes/</code>, lessons under <code className="text-slate-400">academy/</code>
          , and community rules under <code className="text-slate-400">governance/</code>.
        </p>
        <div className="mt-8 border-t border-slate-700 pt-6 text-xs leading-relaxed text-slate-400">
          <p className="font-medium text-slate-300">日本語概要（妙訳）</p>
          <p className="mt-2">
            ROP は、視線や滞留などで意思を伝え、必要なら AI で優先度をつけ、家族とつながる──そのための<strong>最小で文化に合わせ直せる枠組み</strong>です。医療機器や診断の代替ではありません。各国のチームが<strong>翻訳ではなく再構築</strong>できるよう、安全・プライバシー・連携の下限を英語で規定し、本ページ先の Markdown 末尾に同旨の<strong>日本語概要（妙訳）</strong>を全文で載せています。
          </p>
        </div>
      </div>
    </main>
  );
}
