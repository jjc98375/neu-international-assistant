# NEU International Assistant — Build Handoff

> Handoff brief for an agent building **Project 2: NEU International Assistant** — a new,
> standalone app that houses the international-student RAG chatbot (formerly `/assistant`
> in the NEU CS Tracker repo) behind a cutting-edge landing page and a redesigned chat UI.

---

## 0. Where the source lives (read this first)

The full working RAG assistant was **removed from the NEU Grad Planner repo** (this repo,
`github.com/jjc98375/neu-cs-tracker`) but **preserved in two places**:

| What | Where |
|---|---|
| **Git branch (primary source)** | **`neu-international-assistant`** — a snapshot at commit **`cd2dac7`**, the last commit that still contains the entire RAG assistant + `ingestion/` pipeline + all RAG tests. Check it out to see/port every file. |
| Git history | Same repo — commit `cd2dac7` and earlier. The cleanup commit that removed it all is `cb128fc` on `main`. |
| **Local secrets (real keys)** | `ingestion/.env` **still exists untouched on disk** at `/Users/joshcho/Documents/claude_projects/neu-cs-tracker/ingestion/.env` — holds the real `OPENAI_API_KEY` + `QDRANT_*` values. The Python `ingestion/.venv` is also still there. Both are gitignored/untracked. |
| Live Qdrant data | Qdrant Cloud collection **`northeastern_docs`** (~439 points, 46 source PDFs) is already populated — no re-ingest needed to start. |

**To extract the code:**
```bash
cd /Users/joshcho/Documents/claude_projects/neu-cs-tracker
git worktree add ../neu-int-assistant-source neu-international-assistant
# or: git checkout neu-international-assistant   (in a throwaway clone)
```
The RAG files then live under `src/lib/rag*.ts`, `src/app/api/assistant/`,
`src/app/assistant/`, `src/components/ChatMessage.tsx`, and `ingestion/`.

---

## 1. Goal & scope

Build **NEU International Assistant** as a **fresh Next.js app** (per the owner's decision:
*fresh app, port the RAG files* — not a fork of the tracker). It contains:

1. A **cutting-edge landing page** (its own design effort — greenfield).
2. The **RAG chatbot**, ported and redesigned per the brainstorm decisions in §4.

**Constraints set by the owner:**
- **Local prep only** — do **NOT** create a GitHub repo or Vercel project yet. Get the
  split codebase correct on disk; the owner wires remotes + deploy later.
- Fresh app, not a fork. Port the ~7 RAG files + `ingestion/` + tests; rewire config.

---

## 2. What to port (from the `neu-international-assistant` branch)

**Source files:**
- `src/lib/rag-categories.ts` — 8 category keys/labels (**MUST stay in sync with**
  `ingestion/ingest.py`), `Category` type, `isCategory()`.
- `src/lib/rag-clients.ts` — lazy `getOpenAI()` / `getQdrant()` singletons + `COLLECTION`
  const; fail-fast on missing env.
- `src/lib/rag.ts` — `classifyCategory`, `retrieve`, `buildPrompt`, `dedupeSources`,
  `answerQuestion` (the orchestration + web fallback).
- `src/app/api/assistant/route.ts` — POST handler (zod validation, 400/502).
- `src/app/assistant/page.tsx` + `src/components/ChatMessage.tsx` — current chat UI
  (**will be redesigned**, see §4 — port as a functional baseline).
- `ingestion/` — offline Python pipeline (`ingest.py` + `northeastern_docs/` PDF corpus).

**Tests (port + keep green):**
- `__tests__/lib/rag.test.ts`, `__tests__/lib/rag-categories.test.ts`,
  `__tests__/lib/rag-clients.test.ts`
- `__tests__/api/assistant.test.ts`
- `__tests__/components/ChatMessage.test.tsx`
- `__tests__/integration/assistant.integration.test.ts` — opt-in, gated by
  `RUN_RAG_INTEGRATION=1`.

**Deps the fresh app must add** (versions from the source repo):
`openai@^6.42.0`, `@qdrant/js-client-rest@^1.18.0`, `zod@^4.4.3` — on top of the base
Next 16.2.1 / React 19 / TypeScript / Tailwind 4 / SWR / Vitest stack.

**Config to rewire in the fresh app:** `@/*` → `./src/*` path alias (tsconfig +
`vitest.config.mts` via `vite-tsconfig-paths`), Tailwind 4 (`@tailwindcss/postcss`),
`.env.local`, and a `ThemeProvider` if you want dark mode.

---

## 3. RAG architecture (how it works today)

**Flow (single-shot, stateless):**
`POST /api/assistant {question, category?}`
→ auto-classify the question into one of 8 categories via `gpt-4o-mini` (or use an explicit
`category`; `unknown` → no filter)
→ embed with `text-embedding-3-small`
→ category-filtered Qdrant similarity search (k=6)
→ stuff context into a category-aware prompt
→ `gpt-4o-mini` answer
→ return `{category, categoryName, question, answer, sources[], viaWeb?}`.

**Live web fallback** (when the corpus can't answer): `answerQuestion` falls back to a
domain-restricted live web search — OpenAI **Responses API** `web_search` tool with
`filters.allowed_domains: ["northeastern.edu"]`, model **`gpt-5-mini`** (the `*-mini` *chat*
models reject `filters`; the Responses model does not). Two triggers:
1. Top retrieved chunk scores below `WEB_FALLBACK_FLOOR` (**0.5** cosine — no relevant doc), or
2. The answer model returns `{"answered": false}` (a doc was on-topic but lacked the
   figure/policy — `buildPrompt` asks for that JSON).

Web answers return `categoryName: "Live web · northeastern.edu"`, `viaWeb: true`, and
URL-citation sources (`metadata.source: "web"`), which `ChatMessage` renders as clickable
links. Any failure degrades gracefully back to the corpus answer.

**The 8 categories** (keys → labels): `arrival`→Arrival, `billing`→Billing,
`course`→Course Registration, `employment`→Employment, `forms`→forms,
`scholarships`→Scholarships, `tuition`→Tuition&Fees, `visa`→Visa.

---

## 4. New design direction (from the brainstorm)

The owner wants the chatbot page reimagined. Decisions already made:

**Campus toggle (top of page).** Segmented toggle: **Boston · Silicon Valley · Seattle ·
Toronto · London**. Selecting a campus (a) swaps the page **background** to a campus-themed
scene, and (b) injects the campus as a **prompt/web-search hint** (e.g. "answer for the
Seattle campus"). **Visual + prompt hint only** — *no* per-campus corpus / retrieval
filtering (that was explicitly de-scoped).

**Character roster (left side).** A vertical column of **9 pixel-art sprites** =
**8 category experts + 1 neutral "guide" (husky)** for Auto mode. Click a sprite to select
that expert (it "steps up to a stand"); **hover shows the expert's title**. Selecting an
expert sets the category; the **guide/husky = Auto**, where the API auto-classifies and the
matching expert answers.

**Layout: option "C" (avatar-in-chat)** — chosen over the "expert stand" and "speech-bubble"
variants. No large standing character; instead the active expert's sprite is the **avatar on
each answer bubble**, with a medium sprite + title in the chat header. Clean two-column:
roster rail on the left, chat fills the rest, campus background behind. Wireframes for all
three options are in `.superpowers/brainstorm/` (this repo, untracked).

**Characters: AI-generated original pixel sprites** (Ghibli/Pokémon-*inspired* but original —
no copyrighted characters), one per category. Generate with an image tool, drop in `public/`.

**Ready-to-use design prompt** (paste into claude.ai to generate an interactive mockup):

```
Design a full-page UI mockup for an AI chatbot assistant called "NEU International Student
Assistant". Use Layout C: avatar-in-chat style.

TOP BAR — Campus toggle: pill segmented control, 5 options
(Boston | Silicon Valley | Seattle | Toronto | London). Selected campus swaps the page
background: Boston = cloudy blue-gray + brick skyline; Silicon Valley = golden sunset +
tech-park horizon; Seattle = misty green forest + gray rain; Toronto = deep blue twilight +
CN Tower silhouette; London = pale overcast + Big Ben/Thames. Each background = subtle CSS
gradient + simple SVG silhouette, not a photo.

LEFT SIDEBAR — Character roster (~72px wide): 9 pixel-art sprites stacked vertically —
1 Husky "Guide" (default), 2 Airplane pilot "Arrival", 3 Billing clerk "Billing",
4 Professor "Course Registration", 5 Business person "Employment", 6 Clipboard person "Forms",
7 Scholar "Scholarships", 8 Banker/coins "Tuition & Fees", 9 Passport officer "Visa".
Each = 44x44 pixelated sprite in a dark card (#1a2030); active sprite has a gold (#FFD23F)
border glow; hover shows a tooltip with the expert title.

MAIN AREA — Chat: light panel (slight transparency over the campus bg). Header = medium
sprite (32px) of the active expert + title. User bubbles right-aligned (NEU red #CC0000,
white text); assistant bubbles left-aligned (white bg, dark text) with the expert's 22px
sprite as the avatar. Input field + red send button at the bottom.

STYLE: pixel-art aesthetic on the sprites/roster, clean modern UI on the chat side. Palette:
NEU red #CC0000, dark navy #1a2030, off-white #f8f6f2. Make it interactive: campus tabs swap
the background, sprites swap the active expert + header avatar. Show 2 sample exchanges.
```

---

## 5. Environment & data

**Env vars** (set in `.env.local` for the app, `ingestion/.env` for the pipeline):
```
OPENAI_API_KEY=sk-...
QDRANT_URL=https://YOUR-CLUSTER.cloud.qdrant.io:6333
QDRANT_API_KEY=...
QDRANT_COLLECTION=northeastern_docs
```
The real values already exist locally in `ingestion/.env` (see §0).

**Qdrant data.** Collection `northeastern_docs` is already built (~439 points, 46 PDFs as of
2026-06-05) — the app works against it immediately. To **rebuild** from the corpus:
`cd ingestion && ./.venv/bin/python ingest.py` (call the venv's python by **absolute path** —
a miniconda `python` shadows it after `activate`).

**Ingestion gotchas (don't regress):**
1. langchain 1.x — import `RecursiveCharacterTextSplitter` from `langchain_text_splitters`
   (not `langchain.text_splitter`).
2. Qdrant rejects filtered search unless the field has a payload index — `ingest.py` creates
   a keyword index on `metadata.category` after upload. Runtime filter key is
   `metadata.category` (LangChain payloads = `{page_content, metadata:{category, filename,…}}`).

**Corpus is time-sensitive.** PDFs are headless-Chrome printouts of live OGS / Student
Financial Services pages (last refreshed 2026-06-05). Watch for dated content: SEVIS I-901
fee (currently F-1 $350 / J-1 $220), tuition/fee academic year, OGS "Travel Recommendations"
year, USCIS/consular policy banners. Re-capture with:
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf="out.pdf" <URL>` then re-run ingest.

---

## 6. Suggested build order

1. Scaffold a fresh Next.js 16 / React 19 / TS / Tailwind 4 app; wire `@/*` alias + Vitest.
2. Port `src/lib/rag*.ts` + `api/assistant/route.ts` + tests; add the 3 deps; drop in
   `.env.local`. Get `RUN_RAG_INTEGRATION=1` integration test passing against live Qdrant.
3. Port `ChatMessage` + a minimal `/assistant` page; confirm end-to-end answers + web fallback.
4. Build the **new landing page** (greenfield, cutting-edge).
5. Redesign the chat page per §4 (campus toggle + 9-sprite roster + Layout C); generate the
   pixel sprites.
6. Verify: `npx vitest run` green + `npm run build` clean. **Stop before** any GitHub/Vercel
   creation — hand back to the owner.

---
*Generated as part of splitting `neu-cs-tracker` into NEU Grad Planner (this repo) + NEU
International Assistant. Cleanup commit: `cb128fc`. Source branch: `neu-international-assistant`.*
