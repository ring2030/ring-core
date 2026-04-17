import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/validateEnv";

// --- Triage API response ---
export interface TriageResponse {
  response: string; // Spoken line for the resident (English; short)
  summary: string; // Staff-facing summary (English)
  priority: number; // 1–5 (5 = highest)
}

// --- System prompt (fake first turn; v1beta has no systemInstruction) ---
const SYSTEM_PRIMER = [
  {
    role: "user",
    parts: [
      {
        text:
          "You are an AI triage engine for Kiyoko, an older adult. She may speak Japanese; you must still answer with English in `response` and `summary` (for TTS and staff notes).\n\n" +
          "Return ONLY valid JSON, no other text:\n" +
          "{\n" +
          '  "response": "Short reassuring line for the resident (English)",\n' +
          '  "summary": "Brief situation for nurses (English, e.g. restroom request)",\n' +
          '  "priority": integer from 1 to 5 (5 = highest urgency)\n' +
          "}\n\n" +
          "Triage scale:\n" +
          "5: Fall, fracture, severe pain, acute medical distress → treat as emergency\n" +
          "4: Restroom urgent, strong distress, calling for help → respond fast\n" +
          "3: Routine assistance (water, meds, repositioning)\n" +
          "2: Loneliness, insomnia, low mood → supportive check-in\n" +
          "1: Greeting, small talk, questions → friendly conversation\n\n" +
          "Style rules:\n" +
          "- Priority 4–5: no filler; state immediate action (e.g. “I’m getting help now.”). Keep `response` very short.\n" +
          "- Priority 3: brief acknowledgment + reassurance; keep `response` concise.\n" +
          "- Priority 1–2: warm, clear English; answer questions directly when possible.\n" +
          "- Do not invent names or facts. If unclear, ask a short clarifying question.\n" +
          "- Echo important nouns the user used when repeating them adds clarity (romanization is fine).\n\n" +
          "If you understand, reply with exactly: OK",
      },
    ],
  },
  {
    role: "model",
    parts: [{ text: "OK" }],
  },
] as const;

// --- Fallback ---
const FALLBACK: TriageResponse = {
  response: "I hear you. Take it easy.",
  summary:  "Network error — details unknown",
  priority: 1,
};
let apiBackoffUntil = 0;

export function localTriage(message: string): TriageResponse {
  const text = String(message ?? "").replace(/\s+/g, "");

  // Priority 5: pain, injury, rescue (matches kanji & hiragana ASR output)
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

  // Priority 4: restroom / urgent assist
  const urgent4 = new RegExp(
    "トイレ|とれい|お手洗い|おてあらい|化粧室|" +
    "おしっこ|おしっこが|うんこ|うんち|大便|小便|" +
    "漏れ|もれ[そうる]|間に合わ|まにあわ|" +
    "急いで|いそいで|早く来て|はやくきて|早くして|はやくして|" +
    "すぐ来て|すぐきて"
  );

  // Priority 2: loneliness / distress
  const mental2 = new RegExp(
    "寂し|さびし|さみし|" +
    "一人|ひとり|" +
    "怖い|こわ[いよ]|こわくて|" +
    "不安|ふあん|" +
    "眠れ|ねむれ|眠れない|ねむれない|眠れん|" +
    "誰か|だれか|誰もいない|だれもいない|" +
    "泣きた|なきた[いよ]"
  );

  // Priority 3: routine assistance
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
      response: "I’m sending help right away. Stay with me.",
      summary: "Urgent: pain or acute distress",
      priority: 5,
    };
  }

  if (urgent4.test(text)) {
    return {
      response: "On my way — someone will be there very soon.",
      summary: "Urgent restroom / toileting help",
      priority: 4,
    };
  }

  if (mental2.test(text)) {
    const responses = [
      "You’re not alone. We’re here with you.",
      "I’m right here. We’ll come sit with you.",
      "That sounds hard. The team cares about you.",
    ];
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      summary: "Loneliness / anxiety / emotional distress",
      priority: 2,
    };
  }

  if (assist3.test(text)) {
    const responses = [
      "Got it — we’ll bring that to you.",
      "Understood. A nurse will help shortly.",
      "Okay — we’re on it.",
    ];
    return {
      response: responses[Math.floor(Math.random() * responses.length)],
      summary: "Routine assistance (water, meds, repositioning)",
      priority: 3,
    };
  }

  const casualResponses = [
    "Tell me a bit more when you’re ready.",
    "I’m listening — we’ll let the team know.",
    "Thanks for sharing. Anything else on your mind?",
    "I’m with you. What would help most right now?",
  ];

  return {
    response: casualResponses[Math.floor(Math.random() * casualResponses.length)],
    summary: "Casual conversation / routine check-in",
    priority: 1,
  };
}

type GeminiAttemptResult = {
  ok: boolean;
  status: number;
  bodyText: string;
  data?: unknown;
  model: string;
  base: string;
};

type RetryInfoDetail = { "@type"?: string; retryDelay?: string };
type QuotaViolation = { quotaId?: string };
type QuotaFailureDetail = { "@type"?: string; violations?: QuotaViolation[] };
type GeminiErrorEnvelope = { error?: { details?: unknown[] } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

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
      console.log(`[Gemini] endpoint: ${base}/models/${model}`);
      const isV1beta = /\/v1beta$/i.test(base);
      const generationConfig = isV1beta
        ? {
            maxOutputTokens: 200,
            // Low temperature to reduce rambling / paraphrase drift
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
      console.log(`[Gemini] request:`, JSON.stringify({
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
      } catch (e: unknown) {
        clearTimeout(timeout);
        const errMsg =
          e instanceof Error && e.name === "AbortError"
            ? "request timeout (>12s)"
            : toErrorMessage(e);
        console.error(`[Gemini] fetch failed:`, errMsg);
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
      console.log(`[Gemini] HTTP ${res.status}:`, bodyText.slice(0, 400));
      if (res.ok) {
        let data: unknown = {};
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = {};
        }
        return { ok: true, status: res.status, bodyText, data, model, base };
      }

      lastError = { ok: false, status: res.status, bodyText, model, base };

      // Wrong model / API shape → try next candidate
      if (res.status === 404 || res.status === 400) continue;
      if (res.status === 429) continue;
      // Auth errors → stop
      if (res.status === 401 || res.status === 403) return lastError;
    }
  }

  return lastError;
}

// --- Route handler ---
export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body?.message ?? "");
    const history: { role: string; text: string }[] = Array.isArray(body?.history) ? body.history : [];
    console.log(`\n====== [API /chat] request ======`);
    console.log(`[API /chat] message: "${message}"`);

    if (!message) {
      console.log(`[API /chat] empty message → early return`);
      return NextResponse.json({
        response: "Please try speaking again when you’re ready.",
        summary: "Silent or empty message",
        priority: 1,
      } satisfies TriageResponse);
    }

    const apiKey = requireServerEnv("GEMINI_API_KEY");

    if (Date.now() < apiBackoffUntil) {
      const remaining = Math.round((apiBackoffUntil - Date.now()) / 1000);
      console.log(`[API /chat] API backoff (${remaining}s left) → localTriage`);
      const local = localTriage(message);
      console.log(`[API /chat] localTriage:`, local);
      return NextResponse.json(local satisfies TriageResponse);
    }

    const apiBase = process.env.GEMINI_API_BASE?.replace(/\/$/, "");
    // Override with GEMINI_MODEL in .env.local if needed
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
        let backoffMs = 90_000;
        try {
          const errJson = JSON.parse(result.bodyText) as GeminiErrorEnvelope;
          const details = Array.isArray(errJson?.error?.details)
            ? errJson.error.details
            : [];

          // Parse retryDelay (e.g. "25s" → ms)
          const retryInfo = details.find((d): d is RetryInfoDetail => {
            return isRecord(d) && typeof d["@type"] === "string" && d["@type"].includes("RetryInfo");
          });
          if (retryInfo?.retryDelay) {
            const secs = parseFloat(String(retryInfo.retryDelay).replace(/[^0-9.]/g, ""));
            if (!isNaN(secs) && secs > 0) backoffMs = (secs + 10) * 1000;
          }

          // Daily quota exhausted → back off until tomorrow
          const quotaFailure = details.find((d): d is QuotaFailureDetail => {
            return isRecord(d) && typeof d["@type"] === "string" && d["@type"].includes("QuotaFailure");
          });
          const isDailyExhausted = (quotaFailure?.violations ?? []).some(
            (v) => v.quotaId === "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
          );
          if (isDailyExhausted) {
            // Until next midnight JST (min 6h)
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
          /* keep default backoff */
        }
        apiBackoffUntil = Date.now() + backoffMs;
      }
      console.error(
        `[API /chat] Gemini error HTTP ${result.status} | model=${result.model} | base=${result.base}\n`,
        result.bodyText.slice(0, 300),
      );
      const local = localTriage(message);
      console.log(`[API /chat] localTriage (API error):`, local);
      return NextResponse.json(local satisfies TriageResponse);
    }

    const data = result.data as
      | {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        }
      | undefined;
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";

    console.log(`[API /chat] Gemini raw text: ${rawText.slice(0, 200)}`);

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

    console.log(`[API /chat] final (Gemini):`, triage);
    console.log(`====== [API /chat] done ======\n`);
    return NextResponse.json(triage satisfies TriageResponse);
  } catch (error: unknown) {
    console.error(`[API /chat] exception:`, toErrorMessage(error));
    const local = localTriage(message);
    console.log(`[API /chat] localTriage (exception):`, local);
    return NextResponse.json(local satisfies TriageResponse);
  }
}
