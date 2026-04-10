import { NextResponse } from "next/server";

export interface CallSummaryItem {
  reasons: string[];
  notes: string;
  sender: string;
  time: string; // "HH:mm" 形式
}

export interface FamilySummaryRequest {
  date: string; // "YYYY/MM/DD（曜日）"
  calls: CallSummaryItem[];
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

// Gemini に渡すプロンプトを組み立てる
export function buildPrompt(req: FamilySummaryRequest): string {
  const { date, calls } = req;

  if (calls.length === 0) {
    return (
      `今日（${date}）は「きよ子」おばあちゃんからの呼び出しが0件でした。` +
      "家族へ向けた「AI孫娘」として、安心できる温かいメッセージを3〜5文で書いてください。" +
      "呼び出しがなくても、おばあちゃんが穏やかに過ごせたという良い解釈をしてください。"
    );
  }

  const countByReason: Record<string, number> = {};
  for (const c of calls) {
    for (const r of c.reasons) {
      countByReason[r] = (countByReason[r] ?? 0) + 1;
    }
  }
  const countStr = Object.entries(countByReason)
    .map(([k, v]) => `「${k}」${v}回`)
    .join("、");

  const timeline = calls
    .map((c) => `  ${c.time} — ${c.reasons.join("・")}${c.notes ? `（${c.notes}）` : ""}`)
    .join("\n");

  return (
    `今日（${date}）の「きよ子」おばあちゃんの呼び出し記録を教えます。\n\n` +
    `【呼び出し合計】${calls.length}回\n` +
    `【内訳】${countStr}\n` +
    `【タイムライン】\n${timeline}\n\n` +
    "上の記録をもとに、家族（孫娘）として「今日のおばあちゃんのようす」を伝える温かいメッセージを書いてください。\n" +
    "以下のルールを必ず守ってください：\n" +
    "1. 書き出しは「今日のおばあちゃんはね、」などの孫娘らしい話し言葉で始める。\n" +
    "2. 呼び出しの傾向（多い時間帯・多い種別）を自然な言葉で伝える。\n" +
    "3. 家族へのアドバイス（電話してあげて、など）を最後に一言添える。\n" +
    "4. 3〜5文、150文字以内にまとめる。\n" +
    "5. 絵文字は2〜3個まで。ネガティブな表現は避けて温かいトーンを保つ。\n" +
    "メッセージだけを出力してください。見出しや箇条書きは不要です。"
  );
}

export async function POST(req: Request) {
  try {
    const body: FamilySummaryRequest = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY が未設定です" },
        { status: 500 },
      );
    }

    const apiBase =
      process.env.GEMINI_API_BASE?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";

    // 家族向け要約は gemini-1.5-flash を使用（env で上書き可能）
    const model = process.env.GEMINI_FAMILY_MODEL ?? "gemini-1.5-flash";

    const prompt = buildPrompt(body);

    const res = await fetch(
      `${apiBase}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.85,
          },
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Gemini family-summary error:", res.status, errBody);
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const data = (await res.json()) as
      | {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        }
      | undefined;
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      "今日もおばあちゃんは元気に過ごしていたよ。また連絡してあげてね！";

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = toErrorMessage(err);
    console.error("family-summary route error:", message);
    return NextResponse.json(
      { error: message || "不明なエラー" },
      { status: 500 },
    );
  }
}
