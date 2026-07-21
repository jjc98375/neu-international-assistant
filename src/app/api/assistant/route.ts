// src/app/api/assistant/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/rag";
import { isCategory } from "@/lib/rag-categories";
import type { Category } from "@/lib/rag-categories";
import { isCampus } from "@/lib/campuses";
import type { Campus } from "@/lib/campuses";
import { auth } from "@/lib/auth";
import { readAnonCount, serializeAnonCookie, ANON_LIMIT } from "@/lib/gate";
import { PLAN_LIMITS, resolveTier } from "@/lib/quota";
import { countQuestionsToday, getActiveSubscriptions, saveExchange } from "@/lib/chat-store";

const BodySchema = z.object({
  question: z.string().trim().min(1, "question is required").max(2000, "question too long"),
  category: z.string().optional(),
  campus: z.string().optional(),
  conversationId: z.string().optional(),
  expertId: z.string().optional(),
});

function toExpertId(category: string): string {
  const map: Record<string, string> = {
    course: "course", employment: "coop", scholarships: "scholarship",
    billing: "billing", visa: "visa",
  };
  return map[category] ?? "visa"; // "unknown" or unrecognized -> visa (existing safe default)
}

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

  const { question, category, campus } = parsed.data;

  // undefined = auto-classify; a Category = explicit; invalid = 400.
  let resolved: Category | undefined;
  if (!category || category === "auto") {
    resolved = undefined;
  } else if (isCategory(category)) {
    resolved = category;
  } else {
    return NextResponse.json({ error: `unknown category: ${category}` }, { status: 400 });
  }

  // undefined/"all" = no campus filter; a Campus = filtered; invalid = 400.
  let resolvedCampus: Campus | undefined;
  if (!campus || campus === "all") {
    resolvedCampus = undefined;
  } else if (isCampus(campus)) {
    resolvedCampus = campus;
  } else {
    return NextResponse.json({ error: `unknown campus: ${campus}` }, { status: 400 });
  }

  // --- auth / gate / quota (server-side enforcement) ---
  const session = await auth.api.getSession({ headers: req.headers });

  let anonCount = 0;
  let usage: { used: number; limit: number; tier: string };
  if (!session) {
    anonCount = readAnonCount(req.headers.get("cookie"));
    if (anonCount >= ANON_LIMIT) {
      return NextResponse.json({ error: "login_required", gate: true }, { status: 401 });
    }
    usage = { used: anonCount + 1, limit: ANON_LIMIT, tier: "anon" };
  } else {
    const tier = resolveTier(await getActiveSubscriptions(session.user.id));
    const used = await countQuestionsToday(session.user.id);
    if (used >= PLAN_LIMITS[tier]) {
      return NextResponse.json(
        { error: "quota_exceeded", usage: { used, limit: PLAN_LIMITS[tier], tier } },
        { status: 429 });
    }
    usage = { used: used + 1, limit: PLAN_LIMITS[tier], tier };
  }

  try {
    const result = await answerQuestion(question, resolved, resolvedCampus);

    let conversationId = parsed.data.conversationId;
    if (session) {
      try {
        ({ conversationId } = await saveExchange({
          userId: session.user.id, conversationId,
          expertId: parsed.data.expertId ?? toExpertId(result.category),
          campus: resolvedCampus, question, answer: result,
        }));
      } catch (e) {
        console.error("persist failed", e); // RAG answer still returned
      }
    }
    const res = NextResponse.json({ ...result, conversationId, usage });
    if (!session) res.headers.set("Set-Cookie", serializeAnonCookie(anonCount + 1));
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
