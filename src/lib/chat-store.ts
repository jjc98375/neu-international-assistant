// src/lib/chat-store.ts
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages, subscription } from "@/lib/db/schema";
import { etDayStartUtc } from "@/lib/quota";
import type { AssistantAnswer } from "@/lib/rag";

export async function countQuestionsToday(userId: string, now = new Date()): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.role, "user"),
               gte(messages.createdAt, etDayStartUtc(now))));
  return rows[0]?.count ?? 0;
}

export async function getActiveSubscriptions(
  userId: string,
): Promise<{ plan: string; status: string }[]> {
  const rows = await db
    .select({ plan: subscription.plan, status: subscription.status })
    .from(subscription)
    .where(eq(subscription.referenceId, userId));
  // subscription.status is nullable in the schema (defaults to "incomplete" at
  // the DB level); normalize here so resolveTier's `status: string` holds.
  return rows.map((r) => ({ plan: r.plan, status: r.status ?? "incomplete" }));
}

export async function saveExchange(args: {
  userId: string; conversationId?: string; expertId: string; campus?: string;
  question: string; answer: AssistantAnswer;
}): Promise<{ conversationId: string }> {
  let convoId = args.conversationId;
  if (!convoId) {
    convoId = crypto.randomUUID();
    await db.insert(conversations).values({
      id: convoId, userId: args.userId, expertId: args.expertId,
      campus: args.campus ?? null, title: args.question.slice(0, 60),
    });
  } else {
    await db.update(conversations).set({ updatedAt: new Date() })
      .where(eq(conversations.id, convoId));
  }
  await db.insert(messages).values({
    id: crypto.randomUUID(), conversationId: convoId, userId: args.userId,
    role: "user", content: args.question,
  });
  await db.insert(messages).values({
    id: crypto.randomUUID(), conversationId: convoId, userId: args.userId,
    role: "bot", content: args.answer.answer, categoryName: args.answer.categoryName,
    viaWeb: args.answer.viaWeb ?? false, sources: args.answer.sources,
  });
  return { conversationId: convoId };
}
