import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the canonical ROP 1.0 specification markdown for curl / raw viewers.
 * The source of truth remains `docs/spec/ROP-1.0.md` in the repository.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs", "spec", "ROP-1.0.md");
    const body = await readFile(filePath, "utf8");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "spec not found" }, { status: 404 });
  }
}
