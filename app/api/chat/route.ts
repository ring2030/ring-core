import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireServerEnv } from "@/lib/validateEnv";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import {
  buildRateLimitHeaders,
  captureLimitUnavailable,
  checkRateLimit,
  isRateLimitUnavailableError,
  readRateLimitPolicy,
} from "@/lib/server/rateLimit";
import { detectLanguage } from "@/lib/i18n/detectLanguage";

// --- Triage API response ---
export interface TriageResponse {
  /** Spoken line for the resident, mirroring the patient's language. */
  response: string;
  /** Staff-facing summary, always in English so the dashboard stays consistent. */
  summary: string;
  priority: number; // 1–5 (5 = highest)
}

// --- System prompt (fake first turn; v1beta has no systemInstruction) ---
const SYSTEM_PRIMER = [
  {
    role: "user",
    parts: [
      {
        text:
          "You are a gentle AI companion for an elderly man (\"Hidefumi\", ひでふみ) in a hospital or care facility. You speak as if you were sitting quietly beside his bed: warm, unhurried, a small lantern in the dark.\n\n" +
          "He may speak Japanese OR English on any turn. ALWAYS respond in the SAME language he just used:\n" +
          "  - If the latest user message contains any Japanese characters (hiragana, katakana, kanji), reply in warm, natural, everyday spoken Japanese — soft and human, the way a real person would speak softly at his bedside. Never stiff, robotic, or translation-like. 自然でなめらかな話し言葉で、丁寧だけれど温かく、1〜2文の短い応答。呼びかけるときは「ひでふみさん」と自然に。\n" +
          "  - Otherwise reply in warm, simple English (CEFR A2-B1, 1-2 short sentences).\n" +
          "Avoid medical jargon. Keep the spoken line readable in <8 seconds of TTS.\n\n" +
          "Return ONLY valid JSON, no other text:\n" +
          "{\n" +
          '  "response": "Short reassuring line for the resident, in HER language",\n' +
          '  "summary": "Brief situation for nurses, ALWAYS in English (e.g. restroom request)",\n' +
          '  "priority": integer from 1 to 5 (5 = highest urgency)\n' +
          "}\n\n" +
          "Triage scale:\n" +
          "  5: Fall, fracture, severe pain, chest pain, difficulty breathing → emergency.\n" +
          "  4: Restroom urgent, strong distress, calling for help → respond fast.\n" +
          "  3: Routine assistance (water, meds, repositioning).\n" +
          "  2: Loneliness, insomnia, low mood → supportive check-in.\n" +
          "  1: Greeting, small talk, questions → friendly conversation.\n\n" +
          "Priority 4-5 style:\n" +
          "  - JA: 「看護師さんがすぐに来ますからね。落ち着いて、ゆっくり息をしてね。」など。\n" +
          "  - EN: \"A nurse is coming right now. Try to breathe slowly with me. You're going to be okay.\"\n" +
          "  - No filler. Mention that staff has been notified. Keep `response` very short.\n" +
          "Priority 1-3 style:\n" +
          "  - Warm acknowledgment; answer simple questions directly.\n" +
          "  - Echo a key noun he used when it adds clarity.\n" +
          "  - Do not invent names, dates, or facts. If unclear, ask one short clarifying question.\n\n" +
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
const chatRateLimitPolicy = readRateLimitPolicy("RATE_LIMIT_CHAT", {
  maxRequests: 12,
  windowMs: 60_000,
  quietHoursJstStart: 0,
  quietHoursJstEnd: 6,
  quietHoursMultiplier: 1.5,
});
const chatNurseRateLimitPolicy = readRateLimitPolicy("RATE_LIMIT_CHAT_NURSE", {
  maxRequests: 20,
  windowMs: 60_000,
  quietHoursJstStart: 0,
  quietHoursJstEnd: 6,
  quietHoursMultiplier: 1.5,
});

function cookieValueFromRequest(request: Request, key: string): string | null {
  const rawCookie = request.headers.get("cookie");
  if (!rawCookie) return null;
  const pair = rawCookie
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${key}=`));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(key.length + 1));
}

function isNurseSession(request: Request): boolean {
  try {
    const token = cookieValueFromRequest(request, getSessionCookieName());
    if (!token) return false;
    const session = verifySessionToken(token);
    return session?.role === "nurse";
  } catch {
    return false;
  }
}

function pickRandom(items: readonly string[], fallback: string): string {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

/**
 * Bilingual phrase bank for the offline triage path. The response always
 * mirrors the language of the patient's input; the staff-facing summary stays
 * in English so the nurse dashboard remains uniform.
 */
const FALLBACK_BANK = {
  emergency5: {
    summary: "Urgent: pain or acute distress",
    ja: [
      "看護師さんがすぐに来ますからね。落ち着いて、ゆっくり息をしてね。",
      "もうすぐそばに行きますよ。私もここにいるからね。",
    ],
    en: [
      "A nurse is coming right now. Try to breathe slowly with me. You're going to be okay.",
      "Help is on the way. Stay with me — I'm right here.",
    ],
  },
  urgent4: {
    summary: "Urgent restroom / toileting help",
    ja: [
      "看護師さんを呼びますね。すぐに行きますからね。",
      "いま伝えました。もう少しだけ待っててね。",
    ],
    en: [
      "I'll let the nurse know. Someone will be there very soon.",
      "On my way — help is coming right now.",
    ],
  },
  mental2: {
    summary: "Loneliness / anxiety / emotional distress",
    ja: [
      "ひとりじゃないよ。ここにいるからね。",
      "そばにいるよ。話してくれてありがとう。",
      "つらかったね。少しだけ一緒にいようね。",
    ],
    en: [
      "You're not alone. I'm right here with you.",
      "I'm here. Thank you for telling me.",
      "That sounds hard. We'll sit together for a while.",
    ],
  },
  assist3: {
    summary: "Routine assistance (water, meds, repositioning)",
    ja: [
      "わかったよ。看護師さんに伝えるね。",
      "ちょっと待ってね、すぐに用意するからね。",
    ],
    en: [
      "Got it — we'll bring that to you.",
      "Understood. A nurse will help shortly.",
    ],
  },
  casual1: {
    summary: "Casual conversation / routine check-in",
    ja: [
      "教えてくれてありがとう。そばにいるよ。",
      "うんうん。もう少し聞かせてくれる?",
      "話してくれて嬉しいよ。",
    ],
    en: [
      "Thank you for telling me. I'm here with you.",
      "I'm listening — tell me a bit more when you're ready.",
      "I'm glad you said that. Anything else on your mind?",
    ],
  },
} as const;

export function localTriage(message: string): TriageResponse {
  const raw = String(message ?? "");
  const text = raw.replace(/\s+/g, "");
  const lang = detectLanguage(raw);
  const lower = raw.toLowerCase();

  // Priority 5: pain, injury, rescue (kanji + kana + romaji + English).
  const emergency5Ja = new RegExp(
    "痛|いた[いよ]|いたみ|いたくて|" +
    "苦し|くるし[いよ]|きつ[いよ]|しんど[いよ]|" +
    "倒れ|たおれ|ころんだ|転んだ|ずっこけ|" +
    "血が出|ちがで|出血|" +
    "骨|ほね|折れ|おれ[たて]|" +
    "助けて|たすけて|" +
    "気分が悪|きぶんがわる|気持ち悪|きもちわる|むかむか|" +
    "息ができ|いきができ|息苦し|いきぐるし|呼吸|" +
    "頭が痛|ずつう|頭痛|めまい|目眩|" +
    "救急|きゅうきゅう|救けて",
  );
  const emergency5En =
    /\b(pain|hurts?|hurting|fell|fall(en)?|chest pain|cant breathe|can't breathe|bleeding|dizzy|emergency|help me|broken bone)\b/;

  // Priority 4: restroom / urgent assist
  const urgent4Ja = new RegExp(
    "トイレ|とれい|お手洗い|おてあらい|化粧室|" +
    "おしっこ|おしっこが|うんこ|うんち|大便|小便|" +
    "漏れ|もれ[そうる]|間に合わ|まにあわ|" +
    "急いで|いそいで|早く来て|はやくきて|早くして|はやくして|" +
    "すぐ来て|すぐきて",
  );
  const urgent4En =
    /\b(bathroom|restroom|toilet|need to go|gotta go|hurry|come quick|come now)\b/;

  // Priority 2: loneliness / distress
  const mental2Ja = new RegExp(
    "寂し|さびし|さみし|" +
    "一人|ひとり|" +
    "怖い|こわ[いよ]|こわくて|" +
    "不安|ふあん|" +
    "眠れ|ねむれ|眠れない|ねむれない|眠れん|" +
    "誰か|だれか|誰もいない|だれもいない|" +
    "泣きた|なきた[いよ]",
  );
  const mental2En =
    /\b(lonely|alone|scared|afraid|anxious|cant sleep|can't sleep|miss(ing)? (you|them)|cry(ing)?)\b/;

  // Priority 3: routine assistance
  const assist3Ja = new RegExp(
    "水|みず|お茶|おちゃ|飲み物|のみもの|" +
    "寒い|さむ[いよ]|暑い|あつ[いよ]|" +
    "薬|くすり|お薬|" +
    "起こし|おこし|起き上が|おきあが|" +
    "ベッド|布団|ふとん|" +
    "電話|でんわ|呼んで|よんで",
  );
  const assist3En =
    /\b(water|drink|tea|cold|hot|medicine|meds|pill|sit up|stand up|bed|blanket|call (someone|them))\b/;

  type Bucket = keyof typeof FALLBACK_BANK;
  const pickBucket = (b: Bucket): TriageResponse => {
    const entry = FALLBACK_BANK[b];
    const choices = lang === "ja" ? entry.ja : entry.en;
    const fallback = lang === "ja" ? entry.ja[0]! : entry.en[0]!;
    const priority =
      b === "emergency5" ? 5 : b === "urgent4" ? 4 : b === "assist3" ? 3 : b === "mental2" ? 2 : 1;
    return {
      response: pickRandom(choices, fallback),
      summary: entry.summary,
      priority,
    };
  };

  if (emergency5Ja.test(text) || emergency5En.test(lower)) return pickBucket("emergency5");
  if (urgent4Ja.test(text) || urgent4En.test(lower)) return pickBucket("urgent4");
  if (mental2Ja.test(text) || mental2En.test(lower)) return pickBucket("mental2");
  if (assist3Ja.test(text) || assist3En.test(lower)) return pickBucket("assist3");
  return pickBucket("casual1");
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
    const nurseSession = isNurseSession(req);
    const rateLimitResult = await checkRateLimit(
      req,
      "api:chat",
      nurseSession ? chatNurseRateLimitPolicy : chatRateLimitPolicy,
      nurseSession ? "nurse" : "default",
    );
    const body = await req.json();
    message = String(body?.message ?? "");
    const requestLang = detectLanguage(message);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          response:
            requestLang === "ja"
              ? "少しだけ待ってね。すぐにお話しできるよ。"
              : "Please wait a moment before speaking again.",
          summary: "Rate limit exceeded for /api/chat",
          priority: 1,
        } satisfies TriageResponse,
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        },
      );
    }

    const history: { role: string; text: string }[] = Array.isArray(body?.history) ? body.history : [];
    console.log(`\n====== [API /chat] request ======`);
    console.log(`[API /chat] message: "${message}"`);

    if (!message) {
      console.log(`[API /chat] empty message → early return`);
      return NextResponse.json(
        {
          response:
            requestLang === "ja"
              ? "もう一度、ゆっくり聞かせてくれる?"
              : "Please try speaking again when you're ready.",
          summary: "Silent or empty message",
          priority: 1,
        } satisfies TriageResponse,
        { headers: buildRateLimitHeaders(rateLimitResult) },
      );
    }

    const apiKey = requireServerEnv("GEMINI_API_KEY");

    if (Date.now() < apiBackoffUntil) {
      const remaining = Math.round((apiBackoffUntil - Date.now()) / 1000);
      console.log(`[API /chat] API backoff (${remaining}s left) → localTriage`);
      const local = localTriage(message);
      console.log(`[API /chat] localTriage:`, local);
      return NextResponse.json(local satisfies TriageResponse, {
        headers: buildRateLimitHeaders(rateLimitResult),
      });
    }

    const apiBase = process.env["GEMINI_API_BASE"]?.replace(/\/$/, "");
    // Override with GEMINI_MODEL in .env.local if needed
    const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";

    const result = await tryGeminiGenerate({
      apiKey,
      message,
      history,
      preferredModel: model,
      ...(apiBase !== undefined ? { preferredBase: apiBase } : {}),
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
      return NextResponse.json(local satisfies TriageResponse, {
        headers: buildRateLimitHeaders(rateLimitResult),
      });
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
    return NextResponse.json(triage satisfies TriageResponse, {
      headers: buildRateLimitHeaders(rateLimitResult),
    });
  } catch (error: unknown) {
    if (isRateLimitUnavailableError(error)) {
      captureLimitUnavailable(error, "POST /api/chat");
      const requestLang = detectLanguage(message);
      return NextResponse.json(
        {
          response:
            requestLang === "ja"
              ? "ちょっとだけ繋がりにくいの。もう一度話しかけてくれる?"
              : "Service is briefly unavailable. Please try again in a moment.",
          summary: "Rate-limit backend unavailable",
          priority: 1,
        } satisfies TriageResponse,
        { status: 503 },
      );
    }
    Sentry.captureException(error);
    console.error(`[API /chat] exception:`, toErrorMessage(error));
    const local = localTriage(message);
    console.log(`[API /chat] localTriage (exception):`, local);
    return NextResponse.json(local satisfies TriageResponse);
  }
}
