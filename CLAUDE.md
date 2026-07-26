@AGENTS.md

# NEU International Assistant

AI assistant for Northeastern University international students, answering questions about
visas, billing, employment, arrival, scholarships, forms, tuition, and course registration.
Powered by **Retrieval-Augmented Generation** over Office of Global Services (OGS) PDFs, with
a live web-search fallback to `northeastern.edu`.

Built with **Next.js 16.2.1**, **React 19**, **TypeScript**, **Tailwind CSS 4**.

> Split off from the `neu-cs-tracker` repo (now "NEU Grad Planner"). See `HANDOFF.md` for the
> full port history and the planned redesign (campus toggle + character roster + Layout C).

## Architecture

```
src/
  app/
    page.tsx                 # Landing (placeholder — redesign pending)
    assistant/page.tsx       # Chat UI (client component) — quad scene + gate/quota/history wiring
    layout.tsx               # Root layout: nav + ThemeProvider
    globals.css              # Tailwind imports
    api/assistant/route.ts             # POST /api/assistant (zod-validated, session/gate/quota-aware)
    api/auth/[...all]/route.ts         # better-auth catch-all (toNextJsHandler)
    api/conversations/route.ts         # GET (list own) / POST (import a full conversation)
    api/conversations/[id]/route.ts    # PATCH (pin) / DELETE
    api/conversations/[id]/messages/route.ts   # GET messages for one room
  components/
    ChatMessage.tsx          # Renders a Q/A turn + source previews
    ThemeProvider.tsx        # Dark/light mode context
    LoginModal.tsx           # Email/password + Google/Microsoft OAuth buttons
    PaywallModal.tsx         # Shown on 429 quota_exceeded; Stripe checkout via authClient.subscription.upgrade
    ChatDrawer.tsx           # "My chats" history panel — open/pin/delete, usage footer, manage plan/logout
  lib/
    rag-categories.ts        # 8 category keys/labels (MUST match ingestion/ingest.py)
    rag-clients.ts           # lazy getOpenAI()/getQdrant() singletons + COLLECTION
    rag.ts                   # classifyCategory, retrieve, buildPrompt, dedupeSources, answerQuestion
    auth.ts                  # betterAuth() config: drizzleAdapter, email+Google+Microsoft, Stripe plugin
    auth-client.ts           # "use client" createAuthClient() + stripeClient() (signIn/signUp/subscription.*)
    gate.ts                  # signed anonymous-question cookie (HMAC, ANON_LIMIT=2)
    quota.ts                 # PLAN_LIMITS, ET-midnight day boundary, resolveTier()
    chat-store.ts            # countQuestionsToday, getActiveSubscriptions, saveExchange (Drizzle queries)
    sort-conversations.ts    # pinned-first, then updatedAt desc — shared by page.tsx and ChatDrawer
    db/schema.ts             # conversations, messages tables (+ re-exports auth-schema.ts)
    db/auth-schema.ts        # better-auth generated tables: user, session, account, verification, subscription
    db/index.ts              # drizzle-orm/neon-http client (DATABASE_URL)
ingestion/                   # offline Python pipeline (ingest.py + northeastern_docs/ PDFs)
__tests__/                   # Vitest tests (RAG + API + component + auth/quota/gate/db-schema)
```

## RAG flow (single-shot, stateless)

`POST /api/assistant {question, category?}`
→ auto-classify into one of 5 categories via `gpt-4o-mini` (or explicit `category`; `unknown` → no filter)
→ embed with `text-embedding-3-small`
→ category-filtered Qdrant similarity search (k=6)
→ category-aware prompt → `gpt-4o-mini` answer
→ return `{category, categoryName, question, answer, sources[], viaWeb?}`.

**Live web fallback:** when the corpus can't answer, `answerQuestion` falls back to a
domain-restricted live web search (OpenAI Responses `web_search` tool,
`filters.allowed_domains: ["northeastern.edu"]`, model **`gpt-5-mini`** — the `*-mini` *chat*
models reject `filters`). Triggers: (1) top chunk scores below `WEB_FALLBACK_FLOOR` (0.5
cosine), or (2) the answer model returns `{"answered": false}`. Web answers return
`categoryName: "Live web · northeastern.edu"`, `viaWeb: true`, and URL-citation sources
(`metadata.source: "web"`). Failures degrade gracefully to the corpus answer.

**Categories** (key→label): `billing`→Billing & Tuition, `course`→Course Registration,
`employment`→Co-op & Employment, `scholarships`→Scholarships, `visa`→Visa & Immigration.
Consolidated from 8 in 2026-07: doc folders `Arrival` + `forms` now ingest as `visa`,
`Tuition&Fees` as `billing` (folder names on disk unchanged; see CATEGORIES in `ingest.py`).

**Campus filter** (`src/lib/campuses.ts`): requests may carry `campus` (boston,
silicon-valley, seattle, toronto, vancouver, london; `all`/absent = no filter). Docs get a
`metadata.campus` tag at ingestion — campus subfolders (e.g. `Scholarships/Toronto/`) tag
specifically; category-folder roots default to `us` (OGS F-1 docs) or `all` (see
CATEGORY_DEFAULT_CAMPUS in `ingest.py`). Retrieval filters campus ∈ {campus, region, all}
where region is `us` (US campuses), `canada` (Toronto/Vancouver), or `london` — so Canadian
students never retrieve F-1 documents. The UI campus dropdown lives in the quad chip row.
Corpus provenance: `ingestion/SOURCES.md`.

## Accounts, history & billing (added 2026-07)

Auth, per-user conversation history, daily quotas, and Stripe subscriptions, layered onto the
stateless RAG flow above. The `/assistant` page still works fully anonymously (2 free
questions); logging in unlocks a higher daily quota, saved conversation history, and the
option to upgrade.

**Stack:** `better-auth` (`src/lib/auth.ts`) with `drizzleAdapter(db, { provider: "pg" })`,
mounted at `POST/GET /api/auth/[...all]` via `toNextJsHandler(auth)` (`better-auth/next-js`).
Three login methods: `emailAndPassword`, `socialProviders.google`, `socialProviders.microsoft`
(`tenantId: "common"` — personal + org NEU accounts). The `@better-auth/stripe` plugin
(`createCustomerOnSignUp: true`) adds two subscription plans, `plus` and `pro`, each backed by
a Stripe Price ID; client-side, `src/lib/auth-client.ts` wraps `createAuthClient()` +
`stripeClient({ subscription: true })`, exposing `authClient.signIn.email/social`,
`authClient.signUp.email`, and `authClient.subscription.upgrade({ plan, successUrl,
cancelUrl })` (opens Stripe Checkout).

**Tables** (`src/lib/db/schema.ts` + generated `src/lib/db/auth-schema.ts`, Neon Postgres via
`drizzle-orm/neon-http`):
- `conversations` — one row per chat "room": `id`, `userId`, `expertId` (one of the 5
  `EXPERT_IDS`: course/coop/visa/billing/scholarship), `campus`, `title` (first question,
  truncated to 60 chars), `pinned`, `createdAt`/`updatedAt`. Indexed on `(userId, updatedAt)`.
- `messages` — one row per turn: `id`, `conversationId`, `userId` (denormalized onto the
  message specifically so quota counting is a single indexed query, not a join through
  `conversations`), `role` (`"user"` | `"bot"`), `content`, `categoryName`, `viaWeb`, `sources`
  (jsonb). Indexed on `(userId, role, createdAt)` for quota counting and on
  `(conversationId, createdAt)` for room replay.
- `user`/`session`/`account`/`verification` — better-auth's standard tables (unmodified shape);
  `user` carries an extra `stripeCustomerId` column the Stripe plugin populates on signup.
- `subscription` — one row per Stripe subscription: `plan` (`"plus"`/`"pro"`), `referenceId`
  (= `user.id`), `status` (nullable, defaults `"incomplete"` at the DB level), Stripe IDs,
  period/trial/cancel timestamps. `chat-store.getActiveSubscriptions(userId)` reads this;
  `quota.resolveTier()` takes the highest **active** plan (`pro` > `plus` > `free` — any
  non-`"active"` status, e.g. `"incomplete"`/`"canceled"`, is ignored).

No `drizzle-kit` migrations directory exists yet — `drizzle.config.ts` points `drizzle-kit
push`/`studio` at `DATABASE_URL` directly (schema-push workflow, not migration files).

**Quota rules** (`src/lib/quota.ts`): `PLAN_LIMITS = { free: 10, plus: 30, pro: 100 }` questions
per day. "Day" is an America/New_York calendar day — `etDayStartUtc()` computes the UTC instant
of ET midnight via a DST-correct two-step convergence (resolves the UTC offset at the midnight
instant itself, not at "now"), so the boundary is correct across the DST transition and agrees
for every caller within the same ET calendar day. `countQuestionsToday()` (`chat-store.ts`)
counts `messages` rows with `role = "user"` at/after that instant. **Anonymous** (logged-out)
callers instead get a lifetime cap of `ANON_LIMIT = 2` questions, tracked by a signed cookie
(`src/lib/gate.ts`): `neu_anon=<count>.<hmac>`, HMAC-SHA256 over `BETTER_AUTH_SECRET`,
timing-safe compared, `HttpOnly`/`SameSite=Lax`/1-year `Max-Age`. A missing/tampered/malformed
cookie reads back as count `0` (fails open to "not yet gated", not closed).

**Error contract** — `POST /api/assistant`:
- Anonymous + `anonCount >= ANON_LIMIT` → `401 {"error": "login_required", "gate": true}` (no
  RAG call is made). The client (`assistant/page.tsx`) treats `gate: true` specifically as "open
  `LoginModal`, stash the pending question in `sessionStorage` under `neu_pending_ask` so it
  survives a full-page OAuth redirect, auto-resend on login success."
- Logged in + `used >= PLAN_LIMITS[tier]` → `429 {"error": "quota_exceeded", "usage": {used,
  limit, tier}}`. Client opens `PaywallModal`; no auto-retry (the user must upgrade or wait for
  the next ET day).
- Success (either auth state) → `200 {...ragResult, conversationId, usage}`. `usage` is
  `{used, limit, tier: "anon"|"free"|"plus"|"pro"}` and is now included on **every** response
  (success and 429) so the client's usage HUD stays in sync even on a rejected request.
  `conversationId` is only set for logged-in users (`saveExchange()` in `chat-store.ts`); a
  persist failure there is caught and logged — the RAG answer still returns successfully.
- Other REST endpoints (`/api/conversations*`) return `401 {"error": "login_required"}` with no
  session, and `404 {"error": "not_found"}` for a conversation that exists but isn't owned by
  the caller (ownership check happens before every read/write — see `owned()` in
  `api/conversations/[id]/route.ts`).

**Conversations REST API** (all session-scoped to `session.user.id`):
- `GET /api/conversations` → `{conversations: [...]}`, pinned first then `updatedAt` desc.
- `POST /api/conversations` → imports a full conversation (used to persist a room created before
  login, or bulk-import); validates body with zod, inserts the conversation + all messages via
  `db.batch()` (the `neon-http` driver has no interactive-transaction support — `db.batch()`
  sends every statement in one HTTP round trip and Neon runs it as one all-or-nothing
  transaction server-side).
- `PATCH /api/conversations/[id]` `{pinned}` → toggle pin.
- `DELETE /api/conversations/[id]` → deletes messages then the conversation row.
- `GET /api/conversations/[id]/messages` → full message history for one room, `asc(createdAt)`.

**New components:** `LoginModal` (email/password + Google/Microsoft OAuth buttons, in-dialog
error text, login/signup mode toggle), `PaywallModal` (shown on 429; two plan cards, each
calling `authClient.subscription.upgrade`), `ChatDrawer` ("My chats" — lists conversations with
sprite/title/relative-time, hover-reveal pin/delete actions with a two-click delete confirm,
footer usage counter + "manage plan" + logout).

**Not yet live-verified:** `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` and all
`STRIPE_*` values in `.env.local` are placeholders (`placeholder-until-entra-app`,
`sk_test_placeholder`, etc.) — Microsoft OAuth login and the Stripe checkout/webhook/cancel
flow have **not** been exercised end-to-end against real providers. Google OAuth has
real-looking (non-placeholder) local credentials, but — like Microsoft — its redirect flow has
not been driven through a real browser yet; only email/password login was actually
smoke-tested end-to-end (see the Task 12 report in `.superpowers/sdd/` for what was and wasn't
verified). When real Stripe test-mode keys are available, run `stripe listen
--forward-to localhost:3000/api/auth/stripe/webhook` in a separate terminal before testing
checkout/upgrade/cancel locally, so the plugin's webhook handler receives subscription-status
events.

## Environment

Env vars (`.env.local` for the app, `ingestion/.env` for the pipeline):
`OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION=northeastern_docs`.
See `.env.example`. Both `.env.local` and `ingestion/.env` already exist locally (gitignored).

Accounts/billing additions: `DATABASE_URL` (Neon Postgres, used by both `src/lib/db/index.ts`
and `drizzle.config.ts`), `BETTER_AUTH_SECRET` (HMAC secret — also signs the anonymous gate
cookie), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO`. All present and current
in `.env.example` (checked against actual consumers in `src/lib/auth.ts` and
`src/lib/db/index.ts` — no drift as of Task 12).

## Data / ingestion

Qdrant Cloud collection `northeastern_docs` (~439 points, 46 source PDFs). Rebuild:
`cd ingestion && ./.venv/bin/python ingest.py` (call the venv python by **absolute path** — a
miniconda `python` shadows it after `activate`).

**Ingestion gotchas (don't regress):**
1. langchain 1.x — import `RecursiveCharacterTextSplitter` from `langchain_text_splitters`.
2. Qdrant needs a payload index on `metadata.category` for filtered search — `ingest.py`
   creates a keyword index after upload. Runtime filter key is `metadata.category`.

## Testing / development

```bash
npm run dev              # dev server
npm run build            # production build
npx vitest run           # unit + component tests
RUN_RAG_INTEGRATION=1 npx vitest run --config vitest.integration.config.mts   # live Qdrant/OpenAI
```

## Assistant page ("Quad" redesign — implemented)

`/assistant` is a pixel-art scene: an animated hand-drawn SVG of the Boston quad
(`src/components/PixelQuad.tsx` — 320×180 grid, drifting clouds + waving flag, keyframes in
`globals.css`, all disabled under `prefers-reduced-motion`). Five expert sprites stand in one
line — Course Registration (`course`), Co-op (`employment`), Visa (`visa`), Billing
(`billing`), Scholarship (`scholarships`) — clicking one pulls up a game-dialog chat wired to
`/api/assistant` with that expert's category. Per-expert chat histories, source citations,
live-web badge, `?expert=<id>` deep links. Fonts: Press Start 2P + IBM Plex Mono via
next/font. (The original 9-sprite plan in `HANDOFF.md` is superseded; the campus toggle
remains unbuilt.)
