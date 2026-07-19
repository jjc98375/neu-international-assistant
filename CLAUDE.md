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
    assistant/page.tsx       # Chat UI (client component)
    layout.tsx               # Root layout: nav + ThemeProvider
    globals.css              # Tailwind imports
    api/assistant/route.ts   # POST /api/assistant (zod-validated)
  components/
    ChatMessage.tsx          # Renders a Q/A turn + source previews
    ThemeProvider.tsx        # Dark/light mode context
  lib/
    rag-categories.ts        # 8 category keys/labels (MUST match ingestion/ingest.py)
    rag-clients.ts           # lazy getOpenAI()/getQdrant() singletons + COLLECTION
    rag.ts                   # classifyCategory, retrieve, buildPrompt, dedupeSources, answerQuestion
ingestion/                   # offline Python pipeline (ingest.py + northeastern_docs/ PDFs)
__tests__/                   # Vitest tests (RAG + API + component)
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

## Environment

Env vars (`.env.local` for the app, `ingestion/.env` for the pipeline):
`OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION=northeastern_docs`.
See `.env.example`. Both `.env.local` and `ingestion/.env` already exist locally (gitignored).

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
