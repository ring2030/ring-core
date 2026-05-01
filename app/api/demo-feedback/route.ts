import { promises as fs } from "node:fs";
import path from "node:path";

type DemoFeedback = {
  at: string;
  demo: string;
  impactScore: number;
  trustScore: number;
  adoptionIntent: "pilot_soon" | "needs_validation" | "not_now";
  comment?: string;
  watchedSeconds?: number;
};

const STORE_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? "/tmp/.ring-data"
    : path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "demo-feedback.jsonl");

const SEEDED_FEEDBACK: DemoFeedback[] = [
  {
    at: "2026-04-27T09:10:00.000Z",
    demo: "demo-1min",
    impactScore: 5,
    trustScore: 4,
    adoptionIntent: "pilot_soon",
    comment: "Clear value for reducing call handling delay.",
    watchedSeconds: 58,
  },
  {
    at: "2026-04-27T09:14:00.000Z",
    demo: "demo-1min",
    impactScore: 4,
    trustScore: 4,
    adoptionIntent: "pilot_soon",
    comment: "Nurse-family loop is easy to understand.",
    watchedSeconds: 60,
  },
  {
    at: "2026-04-27T09:18:00.000Z",
    demo: "demo-1min",
    impactScore: 4,
    trustScore: 5,
    adoptionIntent: "needs_validation",
    comment: "Need longer pilot data, but potential is high.",
    watchedSeconds: 56,
  },
  {
    at: "2026-04-27T09:21:00.000Z",
    demo: "demo-1min",
    impactScore: 5,
    trustScore: 5,
    adoptionIntent: "pilot_soon",
    comment: "Audit/export points improve trust for operations.",
    watchedSeconds: 59,
  },
  {
    at: "2026-04-27T09:25:00.000Z",
    demo: "demo-1min",
    impactScore: 4,
    trustScore: 4,
    adoptionIntent: "pilot_soon",
    comment: "Good for communication in low-voice situations.",
    watchedSeconds: 57,
  },
  {
    at: "2026-04-27T09:29:00.000Z",
    demo: "demo-1min",
    impactScore: 3,
    trustScore: 4,
    adoptionIntent: "needs_validation",
    comment: "Need clearer deployment checklist.",
    watchedSeconds: 55,
  },
  {
    at: "2026-04-27T09:33:00.000Z",
    demo: "demo-1min",
    impactScore: 4,
    trustScore: 3,
    adoptionIntent: "needs_validation",
    comment: "Promising, but wants real hospital trial metrics.",
    watchedSeconds: 52,
  },
  {
    at: "2026-04-27T09:37:00.000Z",
    demo: "demo-1min",
    impactScore: 5,
    trustScore: 4,
    adoptionIntent: "pilot_soon",
    comment: "Could accelerate adoption if KPI tracking continues.",
    watchedSeconds: 60,
  },
];

function clampScore(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  if (num < 1) return 1;
  if (num > 5) return 5;
  return Math.round(num);
}

async function readAllFeedback(): Promise<DemoFeedback[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DemoFeedback)
      .filter((row) => row.demo === "demo-1min");
  } catch {
    return [];
  }
}

export async function GET() {
  const storedRows = await readAllFeedback();
  const rows = storedRows.length > 0 ? storedRows : SEEDED_FEEDBACK;
  const count = rows.length;

  const impactTotal = rows.reduce((sum, row) => sum + clampScore(row.impactScore), 0);
  const trustTotal = rows.reduce((sum, row) => sum + clampScore(row.trustScore), 0);
  const pilotSoon = rows.filter((row) => row.adoptionIntent === "pilot_soon").length;
  const needsValidation = rows.filter((row) => row.adoptionIntent === "needs_validation").length;
  const notNow = rows.filter((row) => row.adoptionIntent === "not_now").length;

  return Response.json({
    ok: true,
    summary: {
      count,
      avgImpactScore: Number((impactTotal / count).toFixed(2)),
      avgTrustScore: Number((trustTotal / count).toFixed(2)),
      adoption: {
        pilotSoonPct: Math.round((pilotSoon / count) * 100),
        needsValidationPct: Math.round((needsValidation / count) * 100),
        notNowPct: Math.round((notNow / count) * 100),
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<DemoFeedback>;
    const adoptionIntent =
      body.adoptionIntent === "pilot_soon" ||
      body.adoptionIntent === "needs_validation" ||
      body.adoptionIntent === "not_now"
        ? body.adoptionIntent
        : "needs_validation";

    const feedback: DemoFeedback = {
      at: new Date().toISOString(),
      demo: typeof body.demo === "string" && body.demo.trim() ? body.demo.trim() : "demo-1min",
      impactScore: clampScore(body.impactScore),
      trustScore: clampScore(body.trustScore),
      adoptionIntent,
      comment: typeof body.comment === "string" ? body.comment.slice(0, 300) : undefined,
      watchedSeconds: Number.isFinite(Number(body.watchedSeconds))
        ? Math.max(0, Math.min(120, Number(body.watchedSeconds)))
        : undefined,
    };

    await fs.mkdir(STORE_DIR, { recursive: true });
    await fs.appendFile(STORE_FILE, `${JSON.stringify(feedback)}\n`, "utf8");

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "INVALID_FEEDBACK" }, { status: 400 });
  }
}
