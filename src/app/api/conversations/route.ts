// src/app/api/conversations/route.ts
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const rows = await db.select().from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt));
  return NextResponse.json({ conversations: rows });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const body = await req.json(); // { expertId, campus?, title, messages: [...] }
  const id = crypto.randomUUID();
  await db.insert(conversations).values({
    id, userId: session.user.id, expertId: body.expertId,
    campus: body.campus ?? null, title: String(body.title).slice(0, 60),
  });
  for (const m of body.messages ?? []) {
    await db.insert(messages).values({
      id: crypto.randomUUID(), conversationId: id, userId: session.user.id,
      role: m.role === "user" ? "user" : "bot", content: String(m.content),
      categoryName: m.categoryName ?? null, viaWeb: !!m.viaWeb, sources: m.sources ?? null,
    });
  }
  return NextResponse.json({ id });
}
