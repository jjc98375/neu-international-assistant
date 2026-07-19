# Accounts, Chat History & Billing — Design

**Date:** 2026-07-18
**Status:** Approved (brainstorm with user, all sections reviewed)

## Context

The NEU International Assistant is a pixel-art chat app (5 expert sprites on the quad, pull-up
game-dialog chat) backed by a RAG pipeline (Qdrant + OpenAI) with campus-aware retrieval. Today
it has **no auth, no database, no persistence** — chats live in client state and vanish on
refresh, and `/api/assistant` is fully stateless.

This feature adds monetized accounts: a login gate for anonymous users, persistent per-user
chat history with pins in a slide-out drawer, server-enforced daily question quotas, and paid
subscriptions that raise the quota. This is a **real paid service** (live Stripe eventually),
built and verified in Stripe test mode first.

## Decisions (agreed during brainstorm)

| Topic | Decision |
|---|---|
| Payments reality | Real service. Build/verify in Stripe **test mode**; flip keys at launch. |
| Login gate | Anonymous users get **2 questions total** (across all experts); the 3rd attempt requires login. |
| Auth methods | Google OAuth, **Microsoft OAuth** (labelled "NEU 학교 계정으로 로그인" — @northeastern.edu accounts are Microsoft org accounts; true university-registered SSO is not possible for third parties), and email + password. |
| Stack | **better-auth** + its official **Stripe plugin**, **Drizzle ORM**, **Neon Postgres** (Vercel Marketplace). Chosen over Clerk (theming limits, per-MAU cost, fee on billing) and Auth.js (no first-class email/password, most glue code). |
| Conversation model | **Multiple conversations** (ChatGPT-style rooms), not one thread per expert. Pins attach to conversations. |
| Sidebar | **Left slide-out drawer** ("quest log") over the quad, toggled by a `▤ MY CHATS` chip. Full-width overlay on mobile. |
| Pricing | Free **10/day** · Husky Plus **$9.99/mo → 30/day** · Husky Pro **$49.99/mo → 100/day**. Daily reset at midnight **America/New_York**. |

## Architecture

```
src/app/api/auth/[...all]/route.ts   better-auth handler (login/OAuth/session + Stripe webhook)
src/app/api/assistant/route.ts       existing RAG + gate/quota checks + message persistence
src/app/api/conversations/…          list / create / pin / delete conversations, fetch messages
src/lib/db/                          drizzle client + schema
src/lib/auth.ts, auth-client.ts      better-auth server / client config
```

- **Server-side enforcement only.** Quota, gate, and tier decisions all happen inside
  `/api/assistant`. The client mirrors state (usage HUD) but can never bypass limits.
- RAG pipeline itself stays DB-independent — persistence wraps around it.

## Data model

better-auth manages `user`, `session`, `account`, `verification`, and (via Stripe plugin)
`subscription`. We add:

| Table | Columns |
|---|---|
| `conversations` | `id`, `userId`, `expertId` (course/coop/visa/billing/scholarship), `campus`, `title` (first question, truncated), `pinned` (bool), `createdAt`, `updatedAt` |
| `messages` | `id`, `conversationId`, `userId` (denormalized for quota counting), `role` (user/bot), `content`, `categoryName`, `viaWeb`, `sources` (jsonb), `createdAt` |

**Quota counting has no counter table**: `SELECT count(*) FROM messages WHERE role='user' AND
userId=? AND createdAt >= <today 00:00 America/New_York>`, backed by an index on
`(userId, role, createdAt)`. At this scale one indexed count per question is cheap, and it
cannot drift out of sync with reality the way a counter table can.

## Flows

### Anonymous gate
1. Questions 1–2: answered normally. A **signed httpOnly cookie** carries the lifetime count;
   the server validates and increments it. Response includes remaining free questions.
2. 3rd attempt: server returns **401 + gate flag** → pixel-themed login modal opens over the
   chat. The typed question is retained client-side and auto-resent after successful login.
3. Login modal: Google button · Microsoft button ("NEU 학교 계정으로 로그인") · email+password
   form (signup/login toggle).
4. On first login, the client imports the anonymous conversation as the user's first saved
   conversation (single POST).
5. Cookie deletion bypass is accepted (2 free questions only; no IP tracking — deliberate).

### Daily quota
- Tier limits: free 10 / plus 30 / pro 100 user-questions per day, per account, reset at
  midnight America/New_York.
- Anonymous 2 questions are separate from the account quota (fresh 10/day after login).
- Usage HUD chip (`TODAY 3/10 ▮`) always visible when logged in.
- At the limit: the question is rejected server-side; UI shows the **upgrade modal** (two
  pixel-styled plan cards) instead of an answer. Reading history stays unlimited.

### Conversations & drawer
- Clicking an expert sprite opens the **most recent** conversation with that expert; `+ NEW`
  in the chat header starts a fresh room.
- Drawer (`▤ MY CHATS`, login-only): pinned section on top, then rest by recency. Row =
  expert sprite icon + title + relative time; hover reveals 📌 toggle and delete.
- Row click opens that conversation in the chat popup (fully resumable).
- Drawer footer: usage indicator, plan management (Stripe Billing Portal link), logout.
- Esc / outside click closes; full-width overlay on mobile.

### Billing
1. Plan card click → better-auth Stripe plugin `subscription.upgrade` → **Stripe Checkout**
   (hosted page) → redirect back to `/assistant?upgraded=1`.
2. Webhooks (`checkout.session.completed`, `customer.subscription.updated/deleted`) update the
   `subscription` table. **Webhooks are the sole source of truth** — the redirect param is
   never trusted.
3. Tier = active subscription's Stripe price ID → 30/100 mapping.
4. Cancel / card change / receipts: **Stripe Billing Portal** (no custom UI). Cancellation
   runs to period end. `past_due` → treated as free tier.

## UI notes

All new surfaces follow the existing pixel system (Press Start 2P + IBM Plex Mono, navy
`#12172a`/`#1a2030`, gold `#FFD23F`, NEU red `#CC0000`, 2px borders, hard shadows): login
modal, drawer, paywall plan cards, usage HUD chip. Copy stays in the app's in-world register
(e.g. gate modal: "전문가들이 계속 도와드리려면 로그인이 필요해요").

## Error handling

- **Webhook failures**: Stripe auto-retries; signature verified with `STRIPE_WEBHOOK_SECRET`.
- **Quota races**: count + insert in one transaction; worst case one extra question — harmless.
- **DB down**: RAG still answers (it is DB-independent); persistence failures are logged, not
  surfaced as chat errors.
- **OAuth failures**: modal shows the in-world error style already used by chat bubbles.

## Testing

- **Unit** (extend existing Vitest suite, keep current 45 green): tier mapping, quota
  calculation (boundaries: midnight reset, 10/30/100), gate decision, conversations/messages
  API with DB mocked.
- **Integration**: Stripe test mode + `stripe listen` webhook forwarding — full path: checkout
  → webhook → tier raised → limit expanded. Payment-failure path via Stripe test cards.
- **Manual E2E checklist**: anonymous 2-question gate → signup (each of the 3 methods) →
  history persists across refresh → pin/unpin → hit free limit → upgrade (test card) → 30/day
  active → cancel via portal.

## Launch checklist (live payments)

- [ ] Stripe account activation — individual/sole-proprietor is sufficient, no company
      required (US). **Note:** if the operator is on an F-1 visa, personal business income may
      constitute unauthorized self-employment — verify status first.
- [ ] Swap test keys → live keys (`STRIPE_SECRET_KEY`, webhook secret, price IDs).
- [ ] Terms of Service, Privacy Policy, refund policy pages.
- [ ] Google & Microsoft OAuth apps: production domain redirect URIs.
- [ ] Vercel deployment + env vars; register production webhook endpoint in Stripe.

## Out of scope (this iteration)

- Team/family plans, annual billing, promo codes.
- Email verification enforcement beyond better-auth defaults.
- Admin dashboard (Stripe Dashboard + Neon console suffice).
- IP-based anonymous abuse prevention.
- Migrating the existing in-memory-only chat behavior for logged-out users beyond the 2-question allowance.
