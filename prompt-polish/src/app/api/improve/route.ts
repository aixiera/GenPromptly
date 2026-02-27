import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODE_TO_INSTRUCTIONS: Record<string, string> = {
  clarity: [
    "Rewrite the user's prompt to be clearer and less ambiguous while keeping the original intent.",
    "Remove fluff, resolve vague references, and make requirements explicit.",
    "Return ONLY the optimized prompt. No explanations.",
  ].join("\n"),
  structure: [
    "Rewrite the user's prompt into a well-structured professional prompt.",
    "Use sections: Goal, Context, Requirements, Constraints, Output Format.",
    "Return ONLY the optimized prompt. No explanations.",
  ].join("\n"),
  detail: [
    "Rewrite the user's prompt to be more detailed and complete.",
    "Add helpful missing fields with placeholders if needed (e.g., [TARGET_AUDIENCE], [TONE]).",
    "Return ONLY the optimized prompt. No explanations.",
  ].join("\n"),
};

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
    if (!MODE_TO_INSTRUCTIONS[m]) {
      return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
    }

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: MODE_TO_INSTRUCTIONS[m],
      input: text,
    });

    return NextResponse.json({ result: resp.output_text ?? "" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error.", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}