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
          '  "response": "おばあちゃんへの返事",\n' +
          '  "summary": "看護師向けの短い状況要約（例: トイレの訴え）",\n' +
          '  "priority": 緊急度の数値（1〜5、5が最高）\n' +
          "}\n\n" +
          "【トリアージ基準】\n" +
          "5: 転倒・骨折・激しい痛みの訴え → 最優先\n" +
          "4: トイレの訴え・強い不安・助けを呼ぶ → 急ぎ対応\n" +
          "3: 通常の介助依頼・水が欲しいなど → 通常対応\n" +
          "2: 寂しい・眠れない・つぶやき → 経過観察\n" +
          "1: 挨拶・世間話・雑談・質問 → 会話を楽しむ\n\n" +
          "【返事のルール】\n" +
          "・緊急度4〜5のときは相槌なしで即行動を伝える（例:「すぐ行きます！」「今すぐ向かいます！」）。20文字以内で簡潔に。\n" +
          "・緊急度3のときは「うんうん」などの相槌を文頭に入れ、要求を受け止める。30文字以内。\n" +
          "・緊急度1〜2のときは話題に正面から答える。質問には具体的に答え、話を自然につなげる（文字数制限なし、ただし話しやすい長さで）。\n" +
          "・難しい言葉は使わない。「です・ます」よりも親しみやすい口調で。\n" +
          "・日本語の語を勝手に言い換えない。ユーザーが言った語（例: お出かけ日和）は同じ語で返す。\n" +
          "・聞き取りが曖昧な語は捏造しない（例: 人名を勝手に作らない）。不明なら短く確認する。\n\n" +
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

  // ── 緊急度5: 痛み・外傷・救助要請 ────────────────────────────────
  // 漢字・ひらがな両方に対応（音声認識はひらがなで返ることが多い）
  const emergency5 = new RegExp(
    "痛|いた[いよ]|いたみ|いたくて|" +
    "苦し|くるし[いよ]|きつ[いよ]|しんど[いよ]|" +
    "倒れ|たおれ|ころんだ|転んだ|ずっこけ|" +
    "血が出|ちがで|出血|" +
    "骨|ほね|折れ|おれ[たて]|" +
    "助けて|たすけて|" +
    "気分が悪|きぶんがわる|気持ち悪|きもちわる|むかむか|" +
    "息ができ|いきができ|息苦し|いきぐるし|呼吸|" +
    "頭が痛|ずつう|頭痛|めまい|目眩|" +
    "救急|きゅうきゅう|救けて"
  );

  // ── 緊急度4: トイレ・急ぎ介助 ──────────────────────────────────
  const urgent4 = new RegExp(
    "トイレ|とれい|お手洗い|おてあらい|化粧室|" +
    "おしっこ|おしっこが|うんこ|うんち|大便|小便|" +
    "漏れ|もれ[そうる]|間に合わ|まにあわ|" +
    "急いで|いそいで|早く来て|はやくきて|早くして|はやくして|" +
    "すぐ来て|すぐきて"
  );

  // ── 緊急度2: 寂しさ・不安・精神的苦痛 ──────────────────────────
  const mental2 = new RegExp(
    "寂し|さびし|さみし|" +
    "一人|ひとり|" +
    "怖い|こわ[いよ]|こわくて|" +
    "不安|ふあん|" +
    "眠れ|ねむれ|眠れない|ねむれない|眠れん|" +
    "誰か|だれか|誰もいない|だれもいない|" +
    "泣きた|なきた[いよ]"
  );

  // ── 緊急度3: 一般介助依頼 ────────────────────────────────────
  const assist3 = new RegExp(
    "水|みず|お茶|おちゃ|飲み物|のみもの|" +
    "寒い|さむ[いよ]|暑い|あつ[いよ]|" +
    "薬|くすり|お薬|" +
    "起こし|おこし|起き上が|おきあが|" +
    "ベッド|布団|ふとん|" +
    "電話|でんわ|呼んで|よんで"
  );

  if (emergency5.test(text)) {
    return {
      response: "大丈夫ですか？今すぐみっちゃんが行きます！",
      summary: "【至急】痛みや体調異常の訴え",
      priority: 5,
    };
  }

  if (urgent4.test(text)) {
    return {
      response: "うんうん、分かりました。今すぐ向かいますね！",
      summary: "トイレ・緊急介助の希望",
      priority: 4,
    };
  }

  if (mental2.test(text)) {
    const responses = [
      "寂しいですよね。大丈夫ですよ、すぐ会いに行きますね。",
      "ここにいますよ。一人じゃないですからね、安心して。",
      "そうですよね。みっちゃんもきよ子さんのこと、いつも気にしていますよ。",
    ];
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      summary: "寂しさ・不安・精神的苦痛の訴え",
      priority: 2,
    };
  }

  if (assist3.test(text)) {
    const responses = [
      "はい、分かりました。今すぐ用意しますね。",
      "そうですね、すぐ持っていきますよ。",
      "了解しました。みっちゃんに伝えますね。",
    ];
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      summary: "一般介助依頼（水・薬・体位など）",
      priority: 3,
    };
  }

  // ── 通常の会話 ───────────────────────────────────────────────
  const casualResponses = [
    "そうなんですね。もう少し聞かせてください。",
    "うんうん、なるほどですね。みっちゃんにも伝えておきますね。",
    "きよ子さんのお話、いつも楽しいですよ。もっと聞かせてください。",
    "そうですか。他に何か気になることはありますか？",
  ];

  return {
    response: casualResponses[Math.floor(Math.random() * casualResponses.length)],
    summary: "日常的な会話・様子見",
    priority: 1,
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
  history?: { role: string; text: string }[];
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
      console.log(`[Gemini] 送信先: ${base}/models/${model}`);
      const isV1beta = /\/v1beta$/i.test(base);
      const generationConfig = isV1beta
        ? {
            maxOutputTokens: 200,
            // 日本語の言い換え暴走を抑える
            temperature: 0.25,
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
            temperature: 0.25,
          };

      const historyContents = (params.history ?? []).map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      }));

      const requestBody = {
        contents: [
          ...SYSTEM_PRIMER,
          ...historyContents,
          { role: "user", parts: [{ text: params.message }] },
        ],
        generationConfig,
      };
      console.log(`[Gemini] リクエスト内容:`, JSON.stringify({
        model,
        message: params.message,
        generationConfig,
      }, null, 2));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        });
      } catch (e: any) {
        clearTimeout(timeout);
        const errMsg = e?.name === "AbortError" ? "request timeout (12s超過)" : String(e?.message ?? e);
        console.error(`[Gemini] fetch失敗:`, errMsg);
        lastError = {
          ok: false,
          status: 599,
          bodyText: errMsg,
          model,
          base,
        };
        continue;
      }
      clearTimeout(timeout);
      const bodyText = await res.text();
      console.log(`[Gemini] レスポンス HTTP ${res.status}:`, bodyText.slice(0, 400));
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
    const history: { role: string; text: string }[] = Array.isArray(body?.history) ? body.history : [];
    console.log(`\n====== [API /chat] リクエスト受信 ======`);
    console.log(`[API /chat] ユーザー発言: "${message}"`);

    if (!message) {
      console.log(`[API /chat] 空メッセージのため早期リターン`);
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
      const remaining = Math.round((apiBackoffUntil - Date.now()) / 1000);
      console.log(`[API /chat] APIバックオフ中 (残り約${remaining}秒) → localTriage使用`);
      const local = localTriage(message);
      console.log(`[API /chat] localTriage結果:`, local);
      return NextResponse.json(local satisfies TriageResponse);
    }

    const apiBase = process.env.GEMINI_API_BASE?.replace(/\/$/, "");
    // 日本語の安定性重視。必要なら .env.local の GEMINI_MODEL で上書き可能
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const result = await tryGeminiGenerate({
      apiKey,
      message,
      history,
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
        `[API /chat] Geminiエラー HTTP ${result.status} | model=${result.model} | base=${result.base}\n`,
        result.bodyText.slice(0, 300),
      );
      const local = localTriage(message);
      console.log(`[API /chat] localTriage結果 (API失敗):`, local);
      return NextResponse.json(local satisfies TriageResponse);
    }

    const data = result.data;
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";

    console.log(`[API /chat] Gemini生レスポンステキスト: ${rawText.slice(0, 200)}`);

    let triage: TriageResponse;
    try {
      const parsed = JSON.parse(rawText);
      triage = {
        response: String(parsed.response ?? FALLBACK.response),
        summary:  String(parsed.summary  ?? FALLBACK.summary),
        priority: Number(parsed.priority ?? FALLBACK.priority),
      };
    } catch {
      triage = { ...FALLBACK, response: rawText.slice(0, 40) || FALLBACK.response };
    }

    console.log(`[API /chat] 最終レスポンス (Gemini成功):`, triage);
    console.log(`====== [API /chat] 完了 ======\n`);
    return NextResponse.json(triage satisfies TriageResponse);
  } catch (error: any) {
    console.error(`[API /chat] 例外発生:`, error?.message ?? error);
    const local = localTriage(message);
    console.log(`[API /chat] localTriage結果 (例外):`, local);
    return NextResponse.json(local satisfies TriageResponse);
  }
}
