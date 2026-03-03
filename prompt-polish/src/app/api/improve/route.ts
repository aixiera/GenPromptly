import { NextResponse } from "next/server";
import { optimizePrompt } from "../../../lib/ai/optimizer";

export const runtime = "nodejs";

const VALID_MODES = new Set(["clarity", "structure", "detail"]);

export async function POST(req: Request) {
  try {
    const { prompt, mode } = await req.json();

    const text = String(prompt ?? "").trim();
    const m = String(mode ?? "clarity").trim();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    if (!text) {
      return NextResponse.json({ error: "Prompt is empty." }, { status: 400 });
    }
    if (text.length > 8000) {
      return NextResponse.json({ error: "Prompt too long (max 8000 chars)." }, { status: 400 });
    }
    if (!VALID_MODES.has(m)) {
      return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    }

    const result = await optimizePrompt(text, m);

    return NextResponse.json({ result: result.optimizedPrompt });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Server error.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
