@AGENTS.md

# NEU International Assistant

AI assistant for Northeastern University international students, answering questions about
visas, billing, employment, arrival, scholarships, forms, tuition, and course registration.
Powered by **Retrieval-Augmented Generation** over Office of Global Services (OGS) PDFs, with
a live web-search fallback to `northeastern.edu`.

Built with **Next.js 16.2.1**, **React 19**, **TypeScript**, **Tailwind CSS 4**.

**Live:** <https://neu-international-assistant.vercel.app> (Vercel, deploys from `main`).

> Split off from the `neu-cs-tracker` repo (now "NEU Grad Planner"). `HANDOFF.md` holds the
> port history; its planned redesign is superseded — see the Assistant page section below for
> what actually shipped.

## Architecture

```
src/
  app/
    page.tsx                 # Landing — campus gallery/tour (client component)
    assistant/page.tsx       # Chat UI (client component) — quad scene + gate/quota/history wiring
    layout.tsx               # Root layout: nav + ThemeProvider
    globals.css              # Tailwind imports
    api/assistant/route.ts             # POST /api/assistant (zod-validated, session/gate/quota-aware)
    api/auth/[...all]/route.ts         # better-auth catch-all (toNextJsHandler)
    api/conversations/route.ts         # GET (list own) / POST (import a full conversation)
    api/conversations/[id]/route.ts    # PATCH (pin) / DELETE
    api/conversations/[id]/messages/route.ts   # GET messages for one room
    api/health/route.ts                # GET — Qdrant liveness; target of the daily cron
  components/
    ChatMessage.tsx          # Renders a Q/A turn + source previews
    ThemeProvider.tsx        # Dark/light mode context
    LoginModal.tsx           # Email/password + Google/GitHub OAuth buttons
    PixelGlyphs.tsx          # Hand-drawn arrows/cursor/pin/chat marks (see "Pixel glyphs")
    PaywallModal.tsx         # Shown on 429 quota_exceeded; Stripe checkout via authClient.subscription.upgrade
    ChatDrawer.tsx           # "My chats" history panel — open/pin/delete, usage footer, manage plan/logout
  lib/
    rag-categories.ts        # 5 category keys/labels (MUST match ingestion/ingest.py)
    campuses.ts              # campus keys/labels + region grouping for retrieval filtering
    rag-clients.ts           # lazy getOpenAI()/getQdrant() singletons + COLLECTION
    rag.ts                   # classifyCategory, retrieve, buildPrompt, dedupeSources, answerQuestion
    auth.ts                  # betterAuth() config: drizzleAdapter, email+Google+GitHub, Stripe plugin
    auth-client.ts           # "use client" createAuthClient() + stripeClient() (signIn/signUp/subscription.*)
    gate.ts                  # signed anonymous-question cookie (HMAC, ANON_LIMIT=2)
    quota.ts                 # PLAN_LIMITS, Tier/UsageSnapshot types, ET-midnight boundary, resolveTier()
    chat-store.ts            # countQuestionsToday, getActiveSubscriptions, saveExchange (Drizzle queries)
    sort-conversations.ts    # pinned-first, then updatedAt desc — shared by page.tsx and ChatDrawer
    db/schema.ts             # conversations, messages tables (+ re-exports auth-schema.ts)
    db/auth-schema.ts        # better-auth generated tables: user, session, account, verification, subscription
    db/index.ts              # drizzle-orm/neon-http client (DATABASE_URL)
ingestion/                   # offline Python pipeline (ingest.py + northeastern_docs/ PDFs)
__tests__/                   # Vitest tests (RAG + API + component + auth/quota/gate/db-schema)
  setup.ts                   # jsdom lacks matchMedia; stubbed here, not guarded in app code
vercel.json                  # daily cron -> /api/health
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
Three login methods: `emailAndPassword`, `socialProviders.google`, `socialProviders.github`.
better-auth links providers by verified email, so signing in with Google and then GitHub on the
same address lands on one `user` row with two `account` rows — one identity, one history, one
subscription. The `@better-auth/stripe` plugin
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
- The entitlement reads themselves fail → `503 {"error": "quota_unavailable"}`, and no answer
  is generated: without them there is no way to know what the caller is owed, so this fails
  closed. Left unguarded these escaped as an unhandled rejection and Next replied with an HTML
  500, breaking the JSON contract every client path is written against.
- Success (either auth state) → `200 {...ragResult, conversationId, usage}`. `usage` is
  `{used, limit, tier: "anon"|"free"|"plus"|"pro"}` (the `UsageSnapshot` type in `quota.ts`) and
  rides on **every** response, success and 429 alike, so the HUD stays in sync even on a
  rejected request. For signed-in callers `used` is only incremented once `saveExchange()` has
  landed — it writes the `messages` row `countQuestionsToday()` counts, so claiming the
  increment before the write left the HUD one ahead of the truth whenever persistence failed.
  A persist failure is still caught and logged, and the RAG answer still returns: losing the
  answer over a bookkeeping problem would be the worse trade.
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

**New components:** `LoginModal` (email/password + Google/GitHub OAuth buttons, in-dialog
error text, login/signup mode toggle; resets every field when it closes so the next person the
gate stops is not handed the previous one's password), `PaywallModal` (shown on 429; two plan cards, each
calling `authClient.subscription.upgrade`), `ChatDrawer` ("My chats" — lists conversations with
sprite/title/relative-time, hover-reveal pin/delete actions with a two-click delete confirm,
footer usage counter + "manage plan" + logout).

**Verification status (2026-09):** all three login methods have been driven through a real
browser, and the full Stripe flow — checkout, webhook, subscription row, quota lift, cancel —
was exercised end to end in test mode. `.env.local` holds no placeholders.

Two things to know before touching billing:

- **Stripe runs in test mode**, in production too (`sk_test_`). Nobody can pay with a real
  card. Going live means activating the Stripe account (business details, bank) and swapping
  in live keys — deliberately not done.
- **Webhook secrets differ per environment.** Production uses the secret from the dashboard
  endpoint at `/api/auth/stripe/webhook`; local development uses the one `stripe listen
  --forward-to localhost:3000/api/auth/stripe/webhook` prints on startup. Crossing them fails
  signature verification, and the failure is quiet in the worst way: checkout succeeds and the
  subscription never reaches the database.

**Microsoft OAuth was removed** (commit `c50d923`), replaced by GitHub. It is not coming back
cheaply: NEU's tenant does not grant students Entra admin, a personal Microsoft account has no
tenant of its own, and Microsoft has disabled app registration from the shared consumer
tenant — the only remaining path is an Azure signup behind a credit card. Even then NEU's
tenant very likely gates third-party consent, so a "sign in with NEU" button would keep its
label while refusing the accounts it names.

## Environment

Env vars (`.env.local` for the app, `ingestion/.env` for the pipeline):
`OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION=northeastern_docs`.
See `.env.example`. Both `.env.local` and `ingestion/.env` already exist locally (gitignored).

Accounts/billing additions: `DATABASE_URL` (Neon Postgres, used by both `src/lib/db/index.ts`
and `drizzle.config.ts`), `BETTER_AUTH_SECRET` (HMAC secret — also signs the anonymous gate
cookie), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO`. All present in `.env.example`.

**Production (Vercel)** carries the same keys with two deliberate differences:
`BETTER_AUTH_URL` is the deployed origin, not `localhost:3000` — leave it local and every
OAuth callback breaks — and `STRIPE_WEBHOOK_SECRET` is the dashboard endpoint's secret rather
than the CLI's. `BETTER_AUTH_URL` is therefore registered per environment, with the
`development` value pointing back at localhost so `vercel env pull` cannot quietly break local
sign-in. Changing a variable needs a redeploy to take effect.

## Data / ingestion

Qdrant Cloud collection `northeastern_docs` (930 points, 100 source PDFs / 522 pages). Rebuild:
`cd ingestion && ./.venv/bin/python ingest.py` (call the venv python by **absolute path** — a
miniconda `python` shadows it after `activate`).

**Ingestion gotchas (don't regress):**
1. langchain 1.x — import `RecursiveCharacterTextSplitter` from `langchain_text_splitters`.
2. Qdrant needs payload indexes on `metadata.category` and `metadata.campus` for filtered
   search — `ingest.py` creates both after upload. A new cluster has neither until it runs.
3. **The free tier reaps idle clusters, and this project has lost two to it.** Both times every
   `/api/assistant` call failed while the env vars still looked valid, which reads as a code
   bug; the second cluster even accepted TCP on 6333 and only failed at the TLS handshake, so a
   naive reachability check said "fine". `GET /api/health` is the honest probe, and a daily
   Vercel cron (`vercel.json`) hits it to keep the cluster counted as active. If the corpus ever
   goes dark, check that first — recovery is a new cluster, `QDRANT_URL`/`QDRANT_API_KEY` updated
   in **both** `.env.local` and `ingestion/.env`, then a full re-ingest.

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
next/font. (The original 9-sprite plan in `HANDOFF.md` is superseded.)

A campus picker sits in the left rail and rides along on every request. Signed in, the chat
history docks as a 240px rail at `lg` and up and stays an overlay drawer below that — the quad
is a fixed-composition scene, so the rail shifts every fixed layer rather than reflowing them.

**Sprites are positioned in `%`, not `vw`/`vh`.** Viewport units measure the viewport, not the
layer the sprites live in, so insetting that layer for the rail once pushed the rightmost
expert clean off screen. `%` resolves against the layer and is identical when nothing is docked.

### Pixel glyphs

Arrows, the status cursor, the pin and the chats mark are hand-drawn SVG in
`src/components/PixelGlyphs.tsx`, on the same grid as the rest of the art and taking their
colour from `currentColor`. They used to be Unicode characters (`▼ ▾ ▶ ◀ ▮ ▤ 📌`), which Press
Start 2P does not carry: each fell through to a fallback font at a weight and baseline that
never matched, `▤` drew an empty box, and `📌` resolved to a full-colour emoji. Reach for a
glyph component rather than a character.
