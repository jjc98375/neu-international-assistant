// src/app/api/assistant/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/rag";
import { isCategory } from "@/lib/rag-categories";
import type { Category } from "@/lib/rag-categories";

const BodySchema = z.object({
  question: z.string().trim().min(1, "question is required").max(2000, "question too long"),
  category: z.string().optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { question, category } = parsed.data;

  // undefined = auto-classify; a Category = explicit; invalid = 400.
  let resolved: Category | undefined;
  if (!category || category === "auto") {
    resolved = undefined;
  } else if (isCategory(category)) {
    resolved = category;
  } else {
    return NextResponse.json({ error: `unknown category: ${category}` }, { status: 400 });
  }

  try {
    const result = await answerQuestion(question, resolved);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
