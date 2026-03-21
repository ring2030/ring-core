"use client";

import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

const REASON_OPTIONS = [
  "トイレ",
  "お水・お茶",
  "痛い・苦しい",
  "不安・さみしい",
  "その他",
  "必要なし",
] as const;

const DEFAULT_SENDER_NAME = "みっちゃん";

function buildHeaderStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day}（${weekday}）${hour}:${minute}:${second}`;
}

export default function DashboardPage() {
  const [reasons, setReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Hydration mismatch 対策: サーバー/クライアントで初期時刻が一致しないため、マウント後に描画します。
  const [headerStamp, setHeaderStamp] = useState<string>("");

  useEffect(() => {
    const update = () => setHeaderStamp(buildHeaderStamp(new Date()));
    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const toggleReason = useCallback((label: string) => {
    setReasons((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }, []);

  const submit = async () => {
    if (reasons.length === 0) return;

    setSubmitting(true);
    try {
      await addDoc(collection(getFirestoreDb(), "calls"), {
        理由: reasons,
        特記事項: notes,
        送信者: DEFAULT_SENDER_NAME,
        送信日時: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert(
        "Firebaseへの保存に失敗しました。.env.local の設定と Firestore のルールを確認してください。",
      );
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    alert(
      `【送信完了】\n理由: ${reasons.join("、")}\n特記事項: ${notes || "（なし）"}`,
    );
    setReasons([]);
    setNotes("");
  };

  const sendEnabled = reasons.length > 0 && !submitting;

  return (
    <div className="min-h-dvh bg-orange-50 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans text-gray-800">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-lg">
        <header className="bg-orange-400 px-4 py-5 text-center text-white shadow-inner">
          <h1 className="text-xl font-bold tracking-wide">ケア記録帳</h1>
          <p
            className="mt-3 border-t border-orange-300/60 pt-3 font-mono text-sm tabular-nums tracking-tight text-orange-50"
            aria-live="polite"
          >
            {headerStamp}
          </p>
        </header>

        <main className="space-y-6 p-4">
          <section>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-sm font-bold text-orange-600">
                1
              </span>
              <span className="leading-snug">
                コールの具体的な内容を教えてください
              </span>
            </h2>
            <p className="mb-3 pl-[2.75rem] text-sm text-gray-500">
              複数選択できます
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {REASON_OPTIONS.map((label) => {
                const selected = reasons.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={submitting}
                    onClick={() => toggleReason(label)}
                    className={`min-h-[3.25rem] rounded-xl border-2 px-3 py-3 text-left text-base font-semibold transition-all duration-200 disabled:opacity-60 ${
                      selected
                        ? "border-orange-500 bg-orange-50 shadow-md"
                        : "border-gray-100 bg-gray-50 active:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-sm font-bold text-orange-600">
                2
              </span>
              特記事項
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={5}
              className="min-h-[7.5rem] w-full resize-none rounded-xl border-2 border-gray-200 p-3 text-base transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:bg-gray-50"
            />
            <p className="mt-2 text-right text-xs leading-relaxed text-gray-400">
              将来的にはここに「マイクで音声入力」ボタンが付きます。
            </p>
          </section>

          <button
            type="button"
            disabled={!sendEnabled}
            onClick={submit}
            className={`w-full rounded-xl py-4 text-lg font-bold text-white shadow-md transition-all ${
              sendEnabled
                ? "bg-gradient-to-r from-orange-500 to-red-500 active:scale-[0.99]"
                : "cursor-not-allowed bg-gray-300"
            }`}
          >
            {submitting ? "送信中…" : "送信"}
          </button>
        </main>
      </div>
    </div>
  );
}
