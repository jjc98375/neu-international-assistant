// src/app/api/conversations/route.ts
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
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

const ImportBodySchema = z.object({
  expertId: z.string().min(1),
  campus: z.string().optional(),
  title: z.string().min(1),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
    categoryName: z.string().optional(),
    viaWeb: z.boolean().optional(),
    sources: z.unknown().optional(),
  })),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = ImportBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data; // no `userId` field exists on this schema — the session's
  // userId (below) is the only source of truth, so a client can't spoof it.

  const id = crypto.randomUUID();
  const userId = session.user.id;

  // The `neon-http` driver has no interactive-transaction support: `db.transaction()`
  // throws "No transactions support in neon-http driver" at runtime (see
  // node_modules/drizzle-orm/neon-http/session.js). So we use `db.batch()` instead: it
  // sends every statement to Neon in a single HTTP round trip, and Neon runs the whole
  // batch as one all-or-nothing transaction server-side — same rollback guarantee as an
  // interactive tx, just batched rather than session-based.
  const conversationInsert = db.insert(conversations).values({
    id, userId, expertId: data.expertId,
    campus: data.campus ?? null, title: data.title.slice(0, 60),
  });
  const messageInserts = data.messages.map((m) =>
    db.insert(messages).values({
      id: crypto.randomUUID(), conversationId: id, userId,
      role: m.role === "user" ? "user" : "bot", content: m.content,
      categoryName: m.categoryName ?? null, viaWeb: !!m.viaWeb, sources: m.sources ?? null,
    }),
  );

  await db.batch([conversationInsert, ...messageInserts]);

  return NextResponse.json({ id });
}
