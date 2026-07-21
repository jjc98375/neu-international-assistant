// src/app/api/conversations/[id]/route.ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

type Ctx = { params: Promise<{ id: string }> }; // Next 16: params is a Promise

async function owned(req: Request, id: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return { status: 401 as const };
  const rows = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));
  if (rows.length === 0) return { status: 404 as const };
  return { status: 200 as const, session };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.status !== 200) {
    return NextResponse.json({ error: check.status === 401 ? "login_required" : "not_found" }, { status: check.status });
  }
  const { pinned } = await req.json();
  await db.update(conversations).set({ pinned: !!pinned }).where(eq(conversations.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const check = await owned(req, id);
  if (check.status !== 200) {
    return NextResponse.json({ error: check.status === 401 ? "login_required" : "not_found" }, { status: check.status });
  }
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
  return NextResponse.json({ ok: true });
}
