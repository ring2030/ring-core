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
let apiBackoffUntil = 0;

function localTriage(message: string): TriageResponse {
  const text = String(message ?? "").replace(/\s+/g, "");

  const emergency5 = /(痛|苦|倒|血|助けて)/;
  const urgent4 = /(トイレ|おしっこ|漏れ|急いで)/;
  const mental2 = /(寂|一人|怖い|誰か)/;

  if (emergency5.test(text)) {
    return {
      response: "きよ子さん、大丈夫ですか？今すぐみっちゃんが走っていきます！",
      summary: "【至急】痛みや異常の訴え",
      priority: 5,
    };
  }

  if (urgent4.test(text)) {
    return {
      response: "うんうん、トイレですね。今みっちゃんが向かってますからね。",
      summary: "トイレ介助の希望",
      priority: 4,
    };
  }

  if (mental2.test(text)) {
    return {
      response: "寂しいですよね。大丈夫ですよ、いつも近くにいますからね。",
      summary: "寂しさ・不安の訴え",
      priority: 2,
    };
  }

  const casualResponses = [
    "うんうん、聞こえていますよ。続けてお話ししてくださいね。",
    "そうなんですね。みっちゃんにも伝えておきますね。",
    "きよ子さんのお話、聞くのが好きです。ゆっくりで大丈夫ですよ。",
  ];

  return {
    response: casualResponses[Math.floor(Math.random() * casualResponses.length)],
    summary: "日常的なお話し",
    priority: 3,
  };
}

type GeminiAttemptResult = {
  ok: boolean;
  status: number;
  bodyText: string;
  data?: any;
  model: string;
  base: string;
};

async function tryGeminiGenerate(params: {
  apiKey: string;
  message: string;
  preferredModel: string;
  preferredBase?: string;
}): Promise<GeminiAttemptResult> {
  const baseCandidates = [params.preferredBase?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com/v1beta"];
  const modelCandidates = [params.preferredModel];

  let lastError: GeminiAttemptResult = {
    ok: false,
    status: 500,
    bodyText: "No attempt executed",
    model: params.preferredModel,
    base: params.preferredBase ?? "n/a",
  };

  for (const base of baseCandidates) {
    for (const model of modelCandidates) {
      const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
      const isV1beta = /\/v1beta$/i.test(base);
      const generationConfig = isV1beta
        ? {
            maxOutputTokens: 200,
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                response: { type: "string" },
                summary: { type: "string" },
                priority: { type: "integer" },
              },
              required: ["response", "summary", "priority"],
            },
          }
        : {
            maxOutputTokens: 200,
            temperature: 0.7,
          };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              ...SYSTEM_PRIMER,
              { role: "user", parts: [{ text: params.message }] },
            ],
            generationConfig,
          }),
        });
      } catch (e: any) {
        clearTimeout(timeout);
        lastError = {
          ok: false,
          status: 599,
          bodyText: e?.name === "AbortError" ? "request timeout" : String(e?.message ?? e),
          model,
          base,
        };
        continue;
      }
      clearTimeout(timeout);
      const bodyText = await res.text();
      if (res.ok) {
        let data: any = {};
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = {};
        }
        return { ok: true, status: res.status, bodyText, data, model, base };
      }

      lastError = { ok: false, status: res.status, bodyText, model, base };

      // モデル未対応・APIバージョン差異は次候補へ試行
      if (res.status === 404 || res.status === 400) continue;
      // 429 でも別モデルで通ることがあるため継続
      if (res.status === 429) continue;
      // 認可エラーやその他は即終了
      if (res.status === 401 || res.status === 403) return lastError;
    }
  }

  return lastError;
}

// ─── ルートハンドラ ────────────────────────────────────────────
export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body?.message ?? "");
    if (!message) {
      return NextResponse.json({
        response: "もう一度話しかけてくださいね。",
        summary:  "無音または空メッセージ",
        priority: 1,
      } satisfies TriageResponse);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");

    // 直近で 429 が発生した場合は、短時間は外部APIを叩かず即時フォールバック
    if (Date.now() < apiBackoffUntil) {
      return NextResponse.json(localTriage(message) satisfies TriageResponse);
    }

    const apiBase = process.env.GEMINI_API_BASE?.replace(/\/$/, "");
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

    const result = await tryGeminiGenerate({
      apiKey,
      message,
      preferredModel: model,
      preferredBase: apiBase,
    });

    if (!result.ok) {
      if (result.status === 429) {
        // Gemini が教えてくれる retryDelay を尊重し、日次枠切れは長期停止する
        let backoffMs = 90_000; // デフォルト90秒
        try {
          const errJson = JSON.parse(result.bodyText);
          const details: any[] = errJson?.error?.details ?? [];

          // retryDelay フィールドをパース（例: "25s" → 25000ms）
          const retryInfo = details.find((d) => d["@type"]?.includes("RetryInfo"));
          if (retryInfo?.retryDelay) {
            const secs = parseFloat(String(retryInfo.retryDelay).replace(/[^0-9.]/g, ""));
            if (!isNaN(secs) && secs > 0) backoffMs = (secs + 10) * 1000; // +10s バッファ
          }

          // 日次枠切れ（GenerateRequestsPerDayPerProjectPerModel）は当日中使わない
          const quotaFailure = details.find((d) => d["@type"]?.includes("QuotaFailure"));
          const isDailyExhausted = (quotaFailure?.violations ?? []).some(
            (v: any) => v.quotaId === "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
          );
          if (isDailyExhausted) {
            // 翌日の 00:00 (UTC+9) まで停止（最短6時間を保証）
            const nowJst = new Date(Date.now() + 9 * 3_600_000);
            const tomorrowJstMidnight = new Date(
              Date.UTC(
                nowJst.getUTCFullYear(),
                nowJst.getUTCMonth(),
                nowJst.getUTCDate() + 1,
              ) - 9 * 3_600_000
            ).getTime();
            backoffMs = Math.max(tomorrowJstMidnight - Date.now(), 6 * 3_600_000);
            console.warn("Gemini daily quota exhausted – local triage only until tomorrow");
          }
        } catch {
          // パース失敗はデフォルト値のまま
        }
        apiBackoffUntil = Date.now() + backoffMs;
      }
      console.error(
        "Gemini REST error:",
        result.status,
        `base=${result.base}`,
        `model=${result.model}`,
        result.bodyText.slice(0, 200),
      );
      return NextResponse.json(localTriage(message) satisfies TriageResponse);
    }

    const data = result.data;
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
    // 例外時も会話を止めない（ローカル推論）
    return NextResponse.json(localTriage(message) satisfies TriageResponse);
  }
}
