// src/app/api/conversations/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const owner = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));
  if (owner.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rows = await db.select().from(messages)
    .where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return NextResponse.json({ messages: rows });
}
