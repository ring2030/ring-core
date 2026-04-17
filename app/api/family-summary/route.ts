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
      `On ${date}, Kiyoko had 0 calls logged. ` +
      "As a warm AI companion speaking to her family, write 3–5 short reassuring sentences in English. " +
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
    .map(([k, v]) => `"${k}" ×${v}`)
    .join(", ");

  const timeline = calls
    .map((c) => `  ${c.time} — ${c.reasons.join(" · ")}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");

  return (
    `Here is Kiyoko’s call log for ${date}.\n\n` +
    `Total calls: ${calls.length}\n` +
    `By reason: ${countStr}\n` +
    `Timeline:\n${timeline}\n\n` +
    "Write a warm, reassuring message in English for her family (granddaughter tone).\n" +
    "Rules:\n" +
    "1. Start in a conversational way (e.g. “Today, grandma…”).\n" +
    "2. Mention patterns (time of day, common reasons) naturally.\n" +
    "3. End with one gentle suggestion for the family (e.g. call her).\n" +
    "4. Keep it 3–5 sentences, under ~500 characters.\n" +
    "5. Use at most 2–3 emojis; stay positive and kind.\n" +
    "Output only the message — no headings or bullets."
  );
}

export async function POST(req: Request) {
  try {
    const body: FamilySummaryRequest = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set" },
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
      "Grandma had a peaceful day. Give her a call when you can!";

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = toErrorMessage(err);
    console.error("family-summary route error:", message);
    return NextResponse.json(
      { error: message || "Unknown error" },
      { status: 500 },
    );
  }
}
