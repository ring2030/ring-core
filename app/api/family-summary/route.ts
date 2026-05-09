import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/tokens";
import {
  buildRateLimitHeaders,
  captureLimitUnavailable,
  checkRateLimit,
  isRateLimitUnavailableError,
  readRateLimitPolicy,
} from "@/lib/server/rateLimit";

export interface CallSummaryItem {
  reasons: string[];
  notes: string;
  sender: string;
  time: string; // "HH:mm" ??E
}

export interface FamilySummaryRequest {
  date: string; // "YYYY/MM/DD?E????E?E
  calls: CallSummaryItem[];
}

const familySummaryRateLimitPolicy = readRateLimitPolicy("RATE_LIMIT_FAMILY_SUMMARY", {
  maxRequests: 6,
  windowMs: 60_000,
  quietHoursJstStart: 0,
  quietHoursJstEnd: 6,
  quietHoursMultiplier: 1.5,
});
const familySummaryNurseRateLimitPolicy = readRateLimitPolicy("RATE_LIMIT_FAMILY_SUMMARY_NURSE", {
  maxRequests: 10,
  windowMs: 60_000,
  quietHoursJstStart: 0,
  quietHoursJstEnd: 6,
  quietHoursMultiplier: 1.5,
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

// Gemini ????E??????E?????E
export function buildPrompt(req: FamilySummaryRequest): string {
  const { date, calls } = req;

  if (calls.length === 0) {
    return (
      `On ${date}, Kiyoko had 0 calls logged. ` +
      "As a warm AI companion speaking to her family, write 3-4 short reassuring sentences in English. " +
      "Even with no calls, interpret the day positively (restful, calm, etc.)."
    );
  }

  const countByReason: Record<string, number> = {};
  for (const c of calls) {
    for (const r of c.reasons) {
      countByReason[r] = (countByReason[r] ?? 0) + 1;
    }
  }
  const countStr = Object.entries(countByReason)
    .map(([k, v]) => `"${k}" x${v}`)
    .join(", ");

  const timeline = calls
    .map((c) => `  ${c.time} \u2014 ${c.reasons.join(" / ")}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");

  return (
    `Here is Kiyoko's call log for ${date}.\n\n` +
    `Total calls: ${calls.length}\n` +
    `By reason: ${countStr}\n` +
    `Timeline:\n${timeline}\n\n` +
    "Write a warm, reassuring message in English for her family (granddaughter tone).\n" +
    "Rules:\n" +
    "1. Start in a conversational way (e.g. \"Today, grandma...\").\n" +
    "2. Mention patterns (time of day, common reasons) naturally.\n" +
    "3. End with one gentle suggestion for the family (e.g. call her).\n" +
    "4. Keep it 3-4 sentences, under ~500 characters.\n" +
    "5. Use at most 2-3 emojis; stay positive and kind.\n" +
    "Output only the message - no headings or bullets."
  );
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getSessionCookieName())?.value;
    let nurseSession = false;
    if (sessionToken) {
      try {
        nurseSession = verifySessionToken(sessionToken)?.role === "nurse";
      } catch {
        nurseSession = false;
      }
    }
    const rateLimitResult = await checkRateLimit(
      req,
      "api:family-summary",
      nurseSession ? familySummaryNurseRateLimitPolicy : familySummaryRateLimitPolicy,
      nurseSession ? "nurse" : "default",
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please retry shortly." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult),
        },
      );
    }

    const body: FamilySummaryRequest = await req.json();

    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set" },
        {
          status: 500,
          headers: buildRateLimitHeaders(rateLimitResult),
        },
      );
    }

    // Family summary model can be overridden via env.
    const model = process.env["GEMINI_FAMILY_MODEL"] ?? "gemini-1.5-flash";

    const prompt = buildPrompt(body);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 300,
        temperature: 0.85,
      },
    });
    const text =
      response.text?.trim() ??
      "Grandma had a peaceful day. Give her a call when you can!";

    return NextResponse.json(
      { text },
      {
        headers: buildRateLimitHeaders(rateLimitResult),
      },
    );
  } catch (err: unknown) {
    if (isRateLimitUnavailableError(err)) {
      captureLimitUnavailable(err, "POST /api/family-summary");
      return NextResponse.json(
        { error: "Rate-limit backend unavailable." },
        { status: 503 },
      );
    }
    Sentry.captureException(err);
    const message = toErrorMessage(err);
    console.error("family-summary route error:", message);
    return NextResponse.json(
      { error: message || "Unknown error" },
      { status: 500 },
    );
  }
}
