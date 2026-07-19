# Accounts, Chat History & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monetized accounts to the NEU quad assistant: login gate after 2 anonymous questions, persistent conversations with pins in a drawer, server-enforced daily quotas (10/30/100), and Stripe subscriptions.

**Architecture:** better-auth (Google/Microsoft OAuth + email/password) with its Stripe plugin owns identity and subscription state in Neon Postgres via Drizzle. The existing stateless RAG route gains gate/quota checks and message persistence wrapped around it. All enforcement is server-side; the pixel UI (login modal, drawer, HUD, paywall) mirrors state only.

**Tech Stack:** Next.js 16.2.1 App Router · better-auth 1.6.23 + @better-auth/stripe 1.6.23 · drizzle-orm 0.45.2 + @neondatabase/serverless + drizzle-kit · stripe (Node SDK) · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-accounts-history-billing-design.md`

## Global Constraints

- Next.js is 16.2.1 — **read `node_modules/next/dist/docs/`** before writing Next-specific code (AGENTS.md rule). Verify better-auth APIs against the installed package (`node_modules/better-auth`) before Tasks 4, 7, 10 — pinned 1.6.23.
- The existing **45 Vitest tests must stay green** after every task. Run `npx vitest run` before every commit.
- Quota, gate, and tier decisions happen **only** in server code (`/api/assistant`); the client never enforces.
- Quotas: free **10**/day, plan `plus` ($9.99) **30**/day, plan `pro` ($49.99) **100**/day. Day boundary = midnight **America/New_York**. Anonymous lifetime allowance: **2** questions.
- Stripe **test mode only** (live keys are a launch-checklist item, not part of this plan).
- Pixel theme for all new UI: `.font-pixel` / `.font-plex` classes, navy `#12172a`/`#1a2030`, border `#2b3450`, gold `#FFD23F`, red `#CC0000` (+dark `#7a0000`), cream `#f8f6f2`, 2px borders, hard shadows. Copy in-world, active voice (e.g. gate modal: "전문가들이 계속 도와드리려면 로그인이 필요해요").
- Error contract (consumed by UI tasks): gate → **401** `{"error":"login_required","gate":true}`; quota → **429** `{"error":"quota_exceeded","usage":{"used":N,"limit":N,"tier":"free|plus|pro"}}`.
- Env vars (all in `.env.local`; mirror names in `.env.example` with dummy values): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO`.

---

### Task 0: External services setup (human-in-the-loop)

**Files:**
- Modify: `.env.example`

No code logic — collect credentials. Ask the user to do these in a browser; the agent prepares `.env.example` and verifies presence afterward.

- [ ] **Step 1: Update `.env.example`** — append:

```bash
# --- Accounts / DB / Billing (added 2026-07) ---
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
BETTER_AUTH_SECRET=generate-with--openssl-rand--base64-32
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PLUS=price_xxx
STRIPE_PRICE_ID_PRO=price_xxx
```

- [ ] **Step 2: Human checklist** (present to user, wait for `.env.local` values):
  1. **Neon**: console.neon.tech → new project `neu-assistant` → copy pooled connection string → `DATABASE_URL`.
  2. **Google OAuth**: console.cloud.google.com → OAuth client (Web) → redirect URI `http://localhost:3000/api/auth/callback/google`.
  3. **Microsoft OAuth**: portal.azure.com → Entra ID → App registration (accounts in any org directory + personal) → redirect URI `http://localhost:3000/api/auth/callback/microsoft` → client secret.
  4. **Stripe (test mode)**: dashboard.stripe.com → Products: "Husky Plus" $9.99/mo recurring → copy price ID; "Husky Pro" $49.99/mo → price ID. `STRIPE_WEBHOOK_SECRET` comes later from `stripe listen` (Task 11).
  5. `openssl rand -base64 32` → `BETTER_AUTH_SECRET`.

- [ ] **Step 3: Verify + commit**

Run: `grep -c "DATABASE_URL\|BETTER_AUTH_SECRET" .env.local` → expect ≥ 2 (values present; never print them).

```bash
git add .env.example && git commit -m "chore: document accounts/billing env vars"
```

---

### Task 1: Dependencies, Drizzle client, schema, first push

**Files:**
- Create: `src/lib/db/index.ts`, `src/lib/db/schema.ts`, `drizzle.config.ts`
- Test: `__tests__/lib/db-schema.test.ts`

**Interfaces:**
- Produces: `db` (drizzle instance); tables `conversations`, `messages` and auth tables re-exported from `src/lib/db/schema.ts`; `EXPERT_IDS` const.

- [ ] **Step 1: Install**

```bash
npm install better-auth @better-auth/stripe stripe drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 2: Write failing test** `__tests__/lib/db-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { conversations, messages, EXPERT_IDS } from "@/lib/db/schema";
import { getTableName } from "drizzle-orm";

describe("db schema", () => {
  it("defines conversations and messages tables", () => {
    expect(getTableName(conversations)).toBe("conversations");
    expect(getTableName(messages)).toBe("messages");
  });
  it("exposes the five expert ids", () => {
    expect(EXPERT_IDS).toEqual(["course", "coop", "visa", "billing", "scholarship"]);
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run __tests__/lib/db-schema.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement.** `src/lib/db/schema.ts`:

```ts
// src/lib/db/schema.ts
import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const EXPERT_IDS = ["course", "coop", "visa", "billing", "scholarship"] as const;
export type ExpertId = (typeof EXPERT_IDS)[number];

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    userId: text("user_id").notNull(),
    expertId: text("expert_id").notNull(),
    campus: text("campus"),
    title: text("title").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(), // denormalized for quota counting
    role: text("role").notNull(), // "user" | "bot"
    content: text("content").notNull(),
    categoryName: text("category_name"),
    viaWeb: boolean("via_web").notNull().default(false),
    sources: jsonb("sources"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_quota_idx").on(t.userId, t.role, t.createdAt),
          index("messages_convo_idx").on(t.conversationId, t.createdAt)],
);

export * from "./auth-schema"; // generated in Task 4 (create empty file now)
```

Create empty `src/lib/db/auth-schema.ts` containing only `export {};` for now.

`src/lib/db/index.ts`:

```ts
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

`drizzle.config.ts` (repo root):

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: Test passes + push to Neon**

```bash
npx vitest run __tests__/lib/db-schema.test.ts     # PASS
npx dotenv -e .env.local -- npx drizzle-kit push   # or: export DATABASE_URL first; expect "tables created"
npx tsc --noEmit && npx vitest run                  # all green (45 + 2)
```

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: drizzle client + conversations/messages schema on Neon"`

---

### Task 2: Quota library (pure logic)

**Files:**
- Create: `src/lib/quota.ts`
- Test: `__tests__/lib/quota.test.ts`

**Interfaces:**
- Produces: `PLAN_LIMITS: Record<"free"|"plus"|"pro", number>`; `type Tier = "free"|"plus"|"pro"`; `etDayStartUtc(now?: Date): Date`; `resolveTier(subs: Array<{ plan: string; status: string }>): Tier`.

- [ ] **Step 1: Write failing tests** `__tests__/lib/quota.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, etDayStartUtc, resolveTier } from "@/lib/quota";

describe("quota", () => {
  it("maps tiers to daily limits", () => {
    expect(PLAN_LIMITS).toEqual({ free: 10, plus: 30, pro: 100 });
  });

  it("computes ET midnight in summer (EDT, UTC-4)", () => {
    // 2026-07-18T03:00Z == Jul 17 23:00 ET → day start Jul 17 00:00 ET == 04:00Z
    expect(etDayStartUtc(new Date("2026-07-18T03:00:00Z")).toISOString())
      .toBe("2026-07-17T04:00:00.000Z");
  });

  it("computes ET midnight in winter (EST, UTC-5)", () => {
    expect(etDayStartUtc(new Date("2026-01-15T12:00:00Z")).toISOString())
      .toBe("2026-01-15T05:00:00.000Z");
  });

  it("resolves tier from active subscriptions only", () => {
    expect(resolveTier([])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }])).toBe("plus");
    expect(resolveTier([{ plan: "pro", status: "active" }])).toBe("pro");
    expect(resolveTier([{ plan: "pro", status: "past_due" }])).toBe("free");
    expect(resolveTier([{ plan: "plus", status: "active" }, { plan: "pro", status: "active" }])).toBe("pro");
  });
});
```

- [ ] **Step 2: Run** — FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/quota.ts`:

```ts
// src/lib/quota.ts
export const PLAN_LIMITS = { free: 10, plus: 30, pro: 100 } as const;
export type Tier = keyof typeof PLAN_LIMITS;

/** UTC instant of today's midnight in America/New_York (handles DST). */
export function etDayStartUtc(now: Date = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const wallNowAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second);
  const offsetMs = wallNowAsUtc - now.getTime(); // ET-UTC offset at `now`
  const wallMidnightAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  return new Date(wallMidnightAsUtc - offsetMs);
}

/** Highest active paid plan wins; anything not "active" is ignored. */
export function resolveTier(subs: Array<{ plan: string; status: string }>): Tier {
  const active = new Set(subs.filter((s) => s.status === "active").map((s) => s.plan));
  if (active.has("pro")) return "pro";
  if (active.has("plus")) return "plus";
  return "free";
}
```

- [ ] **Step 4: Run** — PASS; full suite green.
- [ ] **Step 5: Commit** — `git commit -am "feat: quota tier mapping and ET day-boundary logic"`

---

### Task 3: Anonymous gate cookie (signed counter)

**Files:**
- Create: `src/lib/gate.ts`
- Test: `__tests__/lib/gate.test.ts`

**Interfaces:**
- Produces: `ANON_LIMIT = 2`; `readAnonCount(cookieHeader: string | null): number`; `serializeAnonCookie(count: number): string` (full Set-Cookie value, name `neu_anon`, HttpOnly/SameSite=Lax/Path=/, 1-year Max-Age). Uses HMAC-SHA256 with `BETTER_AUTH_SECRET`.

- [ ] **Step 1: Failing tests** `__tests__/lib/gate.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { readAnonCount, serializeAnonCookie, ANON_LIMIT } from "@/lib/gate";

beforeAll(() => { process.env.BETTER_AUTH_SECRET = "test-secret"; });

describe("anonymous gate cookie", () => {
  it("round-trips a signed count", () => {
    const setCookie = serializeAnonCookie(1);
    const value = setCookie.split(";")[0]; // "neu_anon=1.<sig>"
    expect(readAnonCount(value)).toBe(1);
  });
  it("returns 0 for missing or malformed cookie", () => {
    expect(readAnonCount(null)).toBe(0);
    expect(readAnonCount("neu_anon=banana")).toBe(0);
  });
  it("rejects a tampered signature", () => {
    const forged = "neu_anon=9." + "x".repeat(43);
    expect(readAnonCount(forged)).toBe(0);
  });
  it("exports the anonymous allowance", () => { expect(ANON_LIMIT).toBe(2); });
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `src/lib/gate.ts`:

```ts
// src/lib/gate.ts
import { createHmac } from "crypto";

export const ANON_LIMIT = 2;
const NAME = "neu_anon";

function sign(v: string): string {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "dev")
    .update(v).digest("base64url");
}

/** Parse the request Cookie header; invalid/absent/tampered → 0. */
export function readAnonCount(cookieHeader: string | null): number {
  const match = cookieHeader?.match(new RegExp(`${NAME}=([^;]+)`));
  if (!match) return 0;
  const [count, sig] = match[1].split(".");
  if (!count || !sig || sign(count) !== sig) return 0;
  const n = parseInt(count, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Full Set-Cookie header value carrying the signed count. */
export function serializeAnonCookie(count: number): string {
  const v = String(count);
  return `${NAME}=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}
```

- [ ] **Step 4: Run** — PASS; full suite green.
- [ ] **Step 5: Commit** — `git commit -am "feat: signed anonymous-question cookie"`

---

### Task 4: better-auth server + client + route handler

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`
- Modify: `src/lib/db/auth-schema.ts` (replace stub with generated schema)

**Interfaces:**
- Produces: `auth` (server; `auth.api.getSession({ headers })`); `authClient` (client; `authClient.useSession()`, `authClient.signIn.social({ provider })`, `authClient.signIn.email(...)`, `authClient.signUp.email(...)`, `authClient.signOut()`, `authClient.subscription.upgrade(...)`, `authClient.subscription.cancel(...)`); auth tables incl. `subscription` in schema.

- [ ] **Step 1: Verify installed API** — skim `node_modules/better-auth/README.md` and `node_modules/@better-auth/stripe/README.md`; confirm `toNextJsHandler`, `drizzleAdapter`, `socialProviders.microsoft`, stripe plugin `subscription.plans` shape. Adjust below if 1.6.23 differs.

- [ ] **Step 2: Implement** `src/lib/auth.ts`:

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { db } from "@/lib/db";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: "common",
    },
  },
  plugins: [
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          { name: "plus", priceId: process.env.STRIPE_PRICE_ID_PLUS! },
          { name: "pro", priceId: process.env.STRIPE_PRICE_ID_PRO! },
        ],
      },
    }),
  ],
});
```

`src/lib/auth-client.ts`:

```ts
// src/lib/auth-client.ts
"use client";
import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

export const authClient = createAuthClient({
  plugins: [stripeClient({ subscription: true })],
});
```

`src/app/api/auth/[...all]/route.ts`:

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 3: Generate auth schema + push**

```bash
npx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/lib/db/auth-schema.ts
npx dotenv -e .env.local -- npx drizzle-kit push
```

Expected: `auth-schema.ts` now defines `user`, `session`, `account`, `verification`, `subscription`; push creates them. If the CLI import of `auth.ts` fails on `db`, temporarily point the CLI at a config using a bare `drizzleAdapter({} as never, { provider: "pg" })` — schema generation only reads plugin/table config.

- [ ] **Step 4: Smoke test**

```bash
npm run dev &  # if not running
curl -s http://localhost:3000/api/auth/get-session   # expect: null (200) — handler mounted
npx tsc --noEmit && npx vitest run                    # all green
```

- [ ] **Step 5: Commit** — `git commit -am "feat: better-auth with Google/Microsoft/email and Stripe plugin"`

---

### Task 5: Gate + quota + persistence in `/api/assistant`

**Files:**
- Modify: `src/app/api/assistant/route.ts`
- Create: `src/lib/chat-store.ts`
- Test: `__tests__/api/assistant.test.ts` (extend), `__tests__/lib/chat-store.test.ts`

**Interfaces:**
- Consumes: `auth.api.getSession`, `readAnonCount`/`serializeAnonCookie`/`ANON_LIMIT`, `PLAN_LIMITS`/`etDayStartUtc`/`resolveTier`, `db` + schema.
- Produces: `chat-store.ts`: `countQuestionsToday(userId: string, now?: Date): Promise<number>`, `getActiveSubscriptions(userId: string): Promise<{plan:string;status:string}[]>`, `saveExchange(args: { userId: string; conversationId?: string; expertId: string; campus?: string; question: string; answer: AssistantAnswer }): Promise<{ conversationId: string }>`. Success response gains `conversationId?` and `usage: { used, limit, tier }`; errors per Global Constraints (401 gate / 429 quota). Anonymous success responses carry the incremented `Set-Cookie` and `usage: { used, limit: ANON_LIMIT, tier: "anon" }`.

- [ ] **Step 1: Failing unit tests** `__tests__/lib/chat-store.test.ts` (mock `@/lib/db`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
import { db } from "@/lib/db";
import { countQuestionsToday, saveExchange } from "@/lib/chat-store";

beforeEach(() => vi.clearAllMocks());

describe("chat-store", () => {
  it("counts today's user messages with the ET day floor", async () => {
    const where = vi.fn().mockResolvedValue([{ count: 3 }]);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where }) } as never);
    const n = await countQuestionsToday("u1", new Date("2026-07-18T03:00:00Z"));
    expect(n).toBe(3);
    expect(where).toHaveBeenCalled(); // floor tested via quota.test; here: query executes
  });

  it("creates a conversation on first exchange and returns its id", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as never);
    const { conversationId } = await saveExchange({
      userId: "u1", expertId: "visa", campus: "boston",
      question: "Do I need a visa?",
      answer: { category: "visa", categoryName: "Visa & Immigration", question: "q",
                answer: "Yes.", sources: [] },
    });
    expect(conversationId).toMatch(/[0-9a-f-]{36}/);
    expect(values).toHaveBeenCalledTimes(3); // conversation + user msg + bot msg
  });
});
```

- [ ] **Step 2: Run** — FAIL. Implement `src/lib/chat-store.ts`:

```ts
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

export async function getActiveSubscriptions(userId: string) {
  return db
    .select({ plan: subscription.plan, status: subscription.status })
    .from(subscription)
    .where(eq(subscription.referenceId, userId));
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
```

Note: when `conversationId` is provided, `saveExchange` performs update+2 inserts; the "3 values calls" test covers the create path only.

- [ ] **Step 3: Extend route.** In `src/app/api/assistant/route.ts`, after zod parse/category/campus resolution and **before** `answerQuestion`:

```ts
// --- auth / gate / quota (server-side enforcement) ---
import { auth } from "@/lib/auth";
import { readAnonCount, serializeAnonCookie, ANON_LIMIT } from "@/lib/gate";
import { PLAN_LIMITS, resolveTier } from "@/lib/quota";
import { countQuestionsToday, getActiveSubscriptions, saveExchange } from "@/lib/chat-store";

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
```

And after `answerQuestion` succeeds (inside the existing try), replace the plain return:

```ts
let conversationId = parsed.data.conversationId; // add `conversationId: z.string().optional()` to BodySchema
if (session) {
  try {
    ({ conversationId } = await saveExchange({
      userId: session.user.id, conversationId, expertId: parsed.data.expertId ?? "visa",
      campus: resolvedCampus, question, answer: result,
    })); // add `expertId: z.string().optional()` to BodySchema
  } catch (e) { console.error("persist failed", e); } // RAG answer still returned
}
const res = NextResponse.json({ ...result, conversationId, usage });
if (!session) res.headers.set("Set-Cookie", serializeAnonCookie(anonCount + 1));
return res;
```

- [ ] **Step 4: Extend route tests** in `__tests__/api/assistant.test.ts`. Add module mocks at top (alongside the existing rag mock):

```ts
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/chat-store", () => ({
  countQuestionsToday: vi.fn(), getActiveSubscriptions: vi.fn().mockResolvedValue([]),
  saveExchange: vi.fn().mockResolvedValue({ conversationId: "c1" }),
}));
import { auth } from "@/lib/auth";
import * as store from "@/lib/chat-store";
```

New cases (each sets `vi.mocked(auth.api.getSession).mockResolvedValue(...)`):

```ts
it("gates the 3rd anonymous question with 401", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  process.env.BETTER_AUTH_SECRET = "test-secret";
  const { serializeAnonCookie } = await import("@/lib/gate");
  const cookie = serializeAnonCookie(2).split(";")[0];
  const res = await POST(new Request("http://l/api/assistant", {
    method: "POST", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ question: "q3" }) }));
  expect(res.status).toBe(401);
  expect((await res.json()).gate).toBe(true);
});

it("answers anonymous question 1 and sets the incremented cookie", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
    question: "q", answer: "a", sources: [] });
  const res = await POST(postReq({ question: "q1" }));
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toContain("neu_anon=1.");
  expect((await res.json()).usage).toEqual({ used: 1, limit: 2, tier: "anon" });
});

it("blocks a free user at 10 with 429 + usage payload", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(store.countQuestionsToday).mockResolvedValue(10);
  const res = await POST(postReq({ question: "q" }));
  expect(res.status).toBe(429);
  expect((await res.json()).usage).toEqual({ used: 10, limit: 10, tier: "free" });
});

it("persists and returns conversationId + usage for a logged-in user", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(store.countQuestionsToday).mockResolvedValue(0);
  vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
    question: "q", answer: "a", sources: [] });
  const res = await POST(postReq({ question: "q", expertId: "visa" }));
  const data = await res.json();
  expect(data.conversationId).toBe("c1");
  expect(data.usage).toEqual({ used: 1, limit: 10, tier: "free" });
});
```

Existing tests: add a default `vi.mocked(auth.api.getSession).mockResolvedValue(null)` and `countQuestionsToday → 0` in `beforeEach` so they run as "anonymous question 1" (their asserted bodies now include extra `usage` key — switch strict `toEqual` on whole body, if any, to field assertions; current tests assert individual fields so they hold).

- [ ] **Step 5: Run** — `npx vitest run` all green. **Commit** — `git commit -am "feat: login gate, daily quota, and persistence in assistant API"`

---

### Task 6: Conversations REST API

**Files:**
- Create: `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/messages/route.ts`
- Test: `__tests__/api/conversations.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/conversations` → `{ conversations: [{ id, expertId, campus, title, pinned, updatedAt }] }` (pinned first, then `updatedAt` desc)
  - `POST /api/conversations` body `{ expertId, campus?, title, messages: [{ role, content, categoryName?, viaWeb?, sources? }] }` → `{ id }` (anonymous-history import)
  - `PATCH /api/conversations/:id` body `{ pinned: boolean }` → `{ ok: true }`
  - `DELETE /api/conversations/:id` → `{ ok: true }` (deletes messages then conversation)
  - `GET /api/conversations/:id/messages` → `{ messages: [{ role, content, categoryName, viaWeb, sources, createdAt }] }`
  - All: 401 `{error:"login_required"}` without session; 404 for a conversation not owned by the caller.

- [ ] **Step 1: Failing tests** `__tests__/api/conversations.test.ts` — mock `@/lib/auth` and `@/lib/db` as in Task 5; cases: 401 when logged out (GET list); GET list orders pinned first (mock db returning rows, assert `orderBy` call or returned order after route-side sort); PATCH toggles pinned for owned row; PATCH on foreign row → 404; DELETE removes messages then conversation. Use the drizzle-mock chain pattern from Task 5 (`db.select → from → where → orderBy`).

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as listGET, POST as importPOST } from "@/app/api/conversations/route";
import { PATCH, DELETE } from "@/app/api/conversations/[id]/route";

beforeEach(() => vi.clearAllMocks());
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }); // Next 16: params is a Promise

it("401s when logged out", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  const res = await listGET(new Request("http://l/api/conversations"));
  expect(res.status).toBe(401);
});

it("lists pinned conversations first", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
  const rows = [
    { id: "a", pinned: false, updatedAt: new Date("2026-07-18") },
    { id: "b", pinned: true, updatedAt: new Date("2026-07-01") },
  ];
  vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }) } as never);
  const data = await (await listGET(new Request("http://l/api/conversations"))).json();
  expect(data.conversations.map((c: {id:string}) => c.id)).toEqual(["a", "b"]); // orderBy delegated to SQL — route returns as-is
});

it("404s a PATCH on a conversation the caller does not own", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) } as never);
  const res = await PATCH(new Request("http://l", { method: "PATCH",
    body: JSON.stringify({ pinned: true }) }), ctx("x"));
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run** — FAIL. Implement the three route files. `src/app/api/conversations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
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
```

`src/app/api/conversations/[id]/route.ts`:

```ts
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
```

`src/app/api/conversations/[id]/messages/route.ts`:

```ts
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
```

- [ ] **Step 3: Run** — PASS; full suite green. `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — `git commit -am "feat: conversations REST API (list/import/pin/delete/messages)"`

---

### Task 7: Login modal + gate wiring in the chat UI

**Files:**
- Create: `src/components/LoginModal.tsx`
- Modify: `src/app/assistant/page.tsx`
- Test: `__tests__/components/login-modal.test.tsx`

**Interfaces:**
- Consumes: `authClient` (Task 4).
- Produces: `<LoginModal open onClose onSuccess />`; page-level `pendingQuestion` retry mechanism; `session` from `authClient.useSession()` available to later tasks.

- [ ] **Step 1: Failing component test** `__tests__/components/login-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { social: vi.fn(), email: vi.fn() }, signUp: { email: vi.fn() } } }));
import { LoginModal } from "@/components/LoginModal";

describe("LoginModal", () => {
  it("renders both OAuth buttons and the email form when open", () => {
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText(/GOOGLE/i)).toBeTruthy();
    expect(screen.getByText(/NEU 학교 계정/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
  });
  it("renders nothing when closed", () => {
    const { container } = render(<LoginModal open={false} onClose={() => {}} onSuccess={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: Run** — FAIL. Implement `src/components/LoginModal.tsx` (pixel-styled dialog, z-[300], dark navy panel, gold border; copy: title "로그인이 필요해요", sub "전문가들이 계속 도와드리려면 로그인해 주세요"). Buttons:

```tsx
"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginModal({ open, onClose, onSuccess }:
  { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  async function submitEmail() {
    setError(null);
    const res = mode === "login"
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
    if (res.error) setError(res.error.message ?? "로그인에 실패했어요. 다시 시도해 주세요.");
    else onSuccess();
  }
  const social = (provider: "google" | "microsoft") =>
    authClient.signIn.social({ provider, callbackURL: "/assistant" });
  // …pixel-styled markup: two OAuth buttons → divider → email/password/(name) inputs →
  // submit button → mode toggle link → error line in the app's red style; ✕ close calls onClose.
}
```

(OAuth uses full-page redirect; `onSuccess` matters for the email path. Write the full JSX in the component following the paywall/login mock styles from the spec's UI notes.)

- [ ] **Step 3: Wire the gate in `page.tsx`:**
  - Add state: `const [loginOpen, setLoginOpen] = useState(false);` and `const pendingQuestion = useRef<string | null>(null);`
  - `const { data: session } = authClient.useSession();`
  - In `send()`, on `res.status === 401` with `data.gate`: `pendingQuestion.current = question; setLoginOpen(true);` remove the optimistic user message (slice the last entry) so it re-appears on retry.
  - `onSuccess` / on `session` transition from null→value: if `pendingQuestion.current`, put it back into `input` and call `send()` once, then clear.
  - After email login success also POST the current anonymous per-expert threads (msgs state entries with >1 message beyond the greeting) to `/api/conversations` once (`imported` ref guard), matching the import body shape from Task 6.
  - Render `<LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={...} />` at page root.
- [ ] **Step 4: Run** — component tests + suite green; manual: with `neu_anon=2` cookie, 3rd question opens the modal; email signup then auto-resends the question.
- [ ] **Step 5: Commit** — `git commit -am "feat: pixel login modal and anonymous gate wiring"`

---

### Task 8: Conversation-aware chat state

**Files:**
- Modify: `src/app/assistant/page.tsx`

**Interfaces:**
- Consumes: `GET /api/conversations`, `GET /api/conversations/:id/messages`, `conversationId`+`usage` from `/api/assistant`.
- Produces: page state `conversationIds: Record<expertId, string | undefined>` (active room per expert), `usage` state `{used,limit,tier} | null` for Task 10; `openConversation(convo)` used by the drawer (Task 9); `+ NEW` button in the chat header.

- [ ] **Step 1: Refactor state.** Keep `msgs: Record<string, Msg[]>` keyed by **expertId** (unchanged for anonymous). Add:

```ts
const [conversationIds, setConversationIds] = useState<Record<string, string | undefined>>({});
const [usage, setUsage] = useState<{ used: number; limit: number; tier: string } | null>(null);
```

  - `send()` body gains `conversationId: conversationIds[expert.id]` and `expertId: expert.id`; on success `setConversationIds(m => ({ ...m, [id]: data.conversationId }));` and `setUsage(data.usage)`.
  - On login (session becomes truthy): fetch `/api/conversations`; for each expert take the most recent conversation, store its id, and lazily fetch messages the first time that expert opens (`GET /:id/messages` → map to `Msg[]`, prepend greeting).
  - `+ NEW` button in the chat header (next to CampusPicker, pixel-styled): `setConversationIds(m => ({ ...m, [activeExpert.id]: undefined })); setMsgs(m => ({ ...m, [activeExpert.id]: [greeting] }));`
  - `openConversation(convo)`: set active expert to `convo.expertId`, set its conversationId, fetch messages, open the popup.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`, suite green; manual: logged-in Q&A survives a refresh (sprite reopens the same room; messages reload).
- [ ] **Step 3: Commit** — `git commit -am "feat: persistent conversation state per expert with + NEW"`

---

### Task 9: History drawer with pins

**Files:**
- Create: `src/components/ChatDrawer.tsx`, `src/lib/sort-conversations.ts`
- Modify: `src/app/assistant/page.tsx` (chip + mount)
- Test: `__tests__/lib/sort-conversations.test.ts`

**Interfaces:**
- Consumes: conversations API, `openConversation` (Task 8), sprite ids (`SPRITES`), `authClient.signOut`.
- Produces: `sortConversations(list): list` (pinned first, `updatedAt` desc within groups); `<ChatDrawer open onClose conversations onOpen(convo) onPin(id,pinned) onDelete(id) usage onManagePlan onLogout />`.

- [ ] **Step 1: Failing test** `__tests__/lib/sort-conversations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortConversations } from "@/lib/sort-conversations";

it("orders pinned first, then most recent", () => {
  const out = sortConversations([
    { id: "old-pin", pinned: true, updatedAt: "2026-07-01T00:00:00Z" },
    { id: "new", pinned: false, updatedAt: "2026-07-18T00:00:00Z" },
    { id: "new-pin", pinned: true, updatedAt: "2026-07-10T00:00:00Z" },
    { id: "old", pinned: false, updatedAt: "2026-06-01T00:00:00Z" },
  ] as never);
  expect(out.map((c: { id: string }) => c.id)).toEqual(["new-pin", "old-pin", "new", "old"]);
});
```

- [ ] **Step 2: Implement** `src/lib/sort-conversations.ts`:

```ts
export function sortConversations<T extends { pinned: boolean; updatedAt: string | Date }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) ||
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
```

- [ ] **Step 3: Build `ChatDrawer.tsx`** — fixed left panel `z-[250]`, `w-[320px] max-w-[85vw]`, navy `#12172a`, 2px `#2b3450` border-right, slide-in via a `quad-drawer` keyframe (add to `globals.css`: `translateX(-105%) → 0`, 0.25s, reduced-motion off). Header "▤ MY CHATS" pixel font. Rows: 24px sprite `<use href="#sp-…">` + title (truncate) + relative time; hover reveals 📌 (calls `onPin(id, !pinned)`, optimistic) and ✕ delete (confirm via a second click state "정말 삭제?"). Footer: `TODAY {usage.used}/{usage.limit}` + "PLAN 관리" (calls `onManagePlan`) + "LOGOUT". Backdrop click + Esc → `onClose`.
- [ ] **Step 4: Mount in page** — chip `▤ MY CHATS` in the chip row (login-only, `pointer-events-auto`); page holds `conversations` state (fetched on login, refetched after pin/delete); `onPin` → `PATCH /api/conversations/:id`; `onDelete` → `DELETE`; list rendered through `sortConversations`.
- [ ] **Step 5: Run** — suite green; manual: pin floats a row to top; delete removes; row click resumes the room.
- [ ] **Step 6: Commit** — `git commit -am "feat: quest-log chat drawer with pins"`

---

### Task 10: Usage HUD + paywall modal + Stripe checkout wiring

**Files:**
- Create: `src/components/PaywallModal.tsx`
- Modify: `src/app/assistant/page.tsx`
- Test: `__tests__/components/paywall-modal.test.tsx`

**Interfaces:**
- Consumes: `usage` state (Task 8), `authClient.subscription` (Task 4), 429 contract (Task 5).
- Produces: `<PaywallModal open onClose usage />` with two plan cards calling `authClient.subscription.upgrade({ plan, successUrl: "/assistant?upgraded=1", cancelUrl: "/assistant" })`; HUD chip; `onManagePlan` for the drawer = `authClient.subscription.cancel({ returnUrl: "/assistant" })` (opens Stripe Billing Portal).

- [ ] **Step 1: Failing test** `__tests__/components/paywall-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
const upgrade = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { subscription: { upgrade } } }));
import { PaywallModal } from "@/components/PaywallModal";

it("shows both plans and requests the chosen upgrade", () => {
  render(<PaywallModal open onClose={() => {}} usage={{ used: 10, limit: 10, tier: "free" }} />);
  expect(screen.getByText(/\$9\.99/)).toBeTruthy();
  expect(screen.getByText(/\$49\.99/)).toBeTruthy();
  fireEvent.click(screen.getByText(/HUSKY PLUS/i));
  expect(upgrade).toHaveBeenCalledWith(expect.objectContaining({ plan: "plus" }));
});
```

- [ ] **Step 2: Implement `PaywallModal`** — pixel dialog `z-[300]`; headline "오늘의 질문을 다 썼어요! ({usage.used}/{usage.limit})"; two cards: HUSKY PLUS — $9.99/월 — 하루 30 질문 / HUSKY PRO — $49.99/월 — 하루 100 질문 (gold-border card for Pro, "BEST" tag); card click → `authClient.subscription.upgrade({ plan, successUrl: "/assistant?upgraded=1", cancelUrl: "/assistant" })`; footnote "언제든 해지 가능 · Stripe 보안 결제".
- [ ] **Step 3: Wire page** — HUD chip in chip row when logged in: `TODAY {usage.used}/{usage.limit} ▮` (turns red at limit). In `send()`, on 429: `setUsage(data.usage); setPaywallOpen(true);` (no error bubble). On `?upgraded=1` in URL: refetch a probe (`GET /api/conversations` is enough to refresh session-derived UI) and show a small toast-style chip "HUSKY PLUS 활성화!" (drop the query param via `history.replaceState`).
- [ ] **Step 4: Run** — suite green. **Commit** — `git commit -am "feat: usage HUD and paywall with Stripe checkout"`

---

### Task 11: Stripe end-to-end verification (test mode)

**Files:** none (manual verification + fixes only)

- [ ] **Step 1:** `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook` → copy `whsec_…` into `.env.local` `STRIPE_WEBHOOK_SECRET`; restart dev server. (Confirm the plugin's webhook path in `node_modules/@better-auth/stripe` README — default `/api/auth/stripe/webhook`.)
- [ ] **Step 2: Manual flow:** free account → ask until 429 → paywall → HUSKY PLUS → Stripe Checkout test card `4242 4242 4242 4242` → redirected back → `subscription` row `status=active, plan=plus` in Neon → ask again: allowed, HUD `11/30`.
- [ ] **Step 3: Cancel path:** drawer → PLAN 관리 → Billing Portal → cancel → webhook fires → row `cancelAtPeriodEnd`/status change per plugin → tier stays `plus` until period end (status remains `active`), `past_due` simulation via Stripe test clock optional.
- [ ] **Step 4:** Fix anything found; run full suite; commit fixes — `git commit -am "fix: stripe e2e findings"`

---

### Task 12: Docs, final sweep

**Files:**
- Modify: `CLAUDE.md`, `.env.example` (if drifted)

- [ ] **Step 1:** Update `CLAUDE.md`: new Accounts & Billing section (stack, tables, quota rules, error contract, env vars, `stripe listen` note), Architecture tree additions (`api/auth`, `api/conversations`, `lib/db/`, `lib/auth*`, `lib/quota|gate|chat-store`, new components).
- [ ] **Step 2:** `npx tsc --noEmit && npx vitest run && npm run build` — all green.
- [ ] **Step 3:** Full manual E2E checklist from the spec (anonymous gate → 3 login methods → history/pins across refresh → quota → upgrade → cancel).
- [ ] **Step 4: Commit** — `git commit -am "docs: accounts/history/billing architecture notes"`
