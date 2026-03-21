import { NextResponse } from "next/server";

// ─── トリアージレスポンス型 ────────────────────────────────────
export interface TriageResponse {
  response: string;  // おばあちゃんへの返事（20文字以内）
  summary:  string;  // 看護師向け要約
  priority: number;  // 緊急度 1〜5（5が最高）
}

// ─── システムプロンプト（フェイク会話ターン方式） ─────────────────
// v1beta API は systemInstruction 非対応のため、最初のターンとして埋め込む
const SYSTEM_PRIMER = [
  {
    role: "user",
    parts: [
      {
        text:
          "あなたはおばあちゃん「きよ子さん」の言葉を理解するAIトリアージエンジンです。\n\n" +
          "おばあちゃんの発言に対し、必ず以下のJSONだけを返してください。説明文は不要です。\n" +
          "{\n" +
          '  "response": "おばあちゃんへの優しい返事（20文字以内）",\n' +
          '  "summary": "看護師向けの短い状況要約（例: トイレの訴え）",\n' +
          '  "priority": 緊急度の数値（1〜5、5が最高）\n' +
          "}\n\n" +
          "【トリアージ基準】\n" +
          "5: 転倒・骨折・激しい痛みの訴え → 最優先\n" +
          "4: トイレの訴え・強い不安・助けを呼ぶ → 急ぎ対応\n" +
          "3: 通常の介助依頼・水が欲しいなど → 通常対応\n" +
          "2: 寂しい・眠れない・つぶやき → 経過観察\n" +
          "1: 挨拶・世間話・感謝 → 記録のみ\n\n" +
          "【返事のルール】\n" +
          "・「うんうん」「そうなの」「あらあら」などの相槌を文頭に入れる\n" +
          "・難しい言葉は使わない\n" +
          "・「痛い」系には「すぐ行くね」と伝える\n\n" +
          "ルールを理解したら「はい、わかりました」とだけ答えてください。",
      },
    ],
  },
  {
    role: "model",
    parts: [{ text: "はい、わかりました。" }],
  },
] as const;

// ─── フォールバック ────────────────────────────────────────────
const FALLBACK: TriageResponse = {
  response: "うんうん、聞こえましたよ。",
  summary:  "通信エラーのため詳細不明",
  priority: 1,
};

// ─── ルートハンドラ ────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({
        response: "もう一度話しかけてくださいね。",
        summary:  "無音または空メッセージ",
        priority: 1,
      } satisfies TriageResponse);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");

    const apiBase =
      process.env.GEMINI_API_BASE?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

    const res = await fetch(
      `${apiBase}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            ...SYSTEM_PRIMER,
            { role: "user", parts: [{ text: message }] },
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
            // JSON モードを強制：スキーマに沿った出力を保証する
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                response: { type: "string" },
                summary:  { type: "string" },
                priority: { type: "integer" },
              },
              required: ["response", "summary", "priority"],
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Gemini REST error:", res.status, errBody);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";

    let triage: TriageResponse;
    try {
      const parsed = JSON.parse(rawText);
      triage = {
        response: String(parsed.response ?? FALLBACK.response),
        summary:  String(parsed.summary  ?? FALLBACK.summary),
        priority: Number(parsed.priority ?? FALLBACK.priority),
      };
    } catch {
      // JSON パース失敗時はフォールバック
      triage = { ...FALLBACK, response: rawText.slice(0, 40) || FALLBACK.response };
    }

    return NextResponse.json(triage satisfies TriageResponse);
  } catch (error: any) {
    console.error("Gemini API Error:", error?.message ?? error);
    return NextResponse.json(
      {
        response: "少し待ってから、もう一度話しかけてね。",
        summary:  "APIエラー",
        priority: 1,
      } satisfies TriageResponse,
      { status: 500 },
    );
  }
}
