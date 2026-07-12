# RAG Chatbot Integration — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design phase)
**Target repo:** `neu-cs-tracker`

## Goal

Bring the Northeastern international-student RAG chatbot into the `neu-cs-tracker`
Next.js app as a new **Assistant** feature. The chatbot answers from the existing
RAG document corpus exactly as it does today, but with a Next.js UI replacing the
Streamlit debug interface. Single Vercel deployment, no new infrastructure.

This is the **baseline** integration: the chatbot is a feature alongside the course
browser and graduation planner. It does NOT (yet) use the user's saved courses or
the live catalog (that "context-aware" extension is explicitly out of scope).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Integration goal | Chatbot as a tracker feature (Next.js UI replaces Streamlit) |
| RAG architecture | Port the query path to TypeScript; one Vercel app; keep `ingest.py` in Python (offline) |
| Repo layout | Merge into `neu-cs-tracker`; ingestion under `ingestion/` (`.vercelignore`'d) |
| Category UX | Auto-route via gpt-4o-mini classification + manual override dropdown; fallback to all-category search on `unknown` |
| Conversation | Single-shot, stateless Q&A (each query independent) |
| Streaming (v1) | Non-streaming JSON (answer + sources in one response) — defer streaming |
| Source PDF download (v1) | Show filename + preview + metadata only; defer downloadable PDFs (needs hosting) |

## Architecture Overview

Single Next.js 16 app on Vercel. The chatbot is:

- a page: `/assistant`
- one route handler: `/api/assistant` (POST)

The RAG query path is reimplemented in TypeScript (OpenAI SDK + Qdrant JS client),
mirroring the Python `NortheasternRAG` class. Ingestion stays in Python and runs
offline to populate the Qdrant Cloud collection. Both data dependencies (OpenAI,
Qdrant Cloud) are already cloud services, so no service to self-host.

## File / Component Inventory (all under `neu-cs-tracker/`)

**New**
- `src/app/assistant/page.tsx` — chat UI (transcript, input box, category dropdown, sources display). Client component.
- `src/app/api/assistant/route.ts` — POST handler orchestrating classify → embed → search → generate.
- `src/lib/rag.ts` — ported RAG core: `AVAILABLE_CATEGORIES`, `classifyCategory()`, `retrieve()`, `answer()`, prompt builder. Mirrors Python `NortheasternRAG`.
- `src/components/ChatMessage.tsx`, `src/components/SourceList.tsx`, `src/components/CategorySelect.tsx` — UI sub-components.

**Moved (legacy / offline)**
- `ingestion/ingest.py`, `ingestion/northeastern_docs/`, `ingestion/requirements.txt` — Python ingestion pipeline, excluded from Vercel deploy via `.vercelignore`.
- Old `Northeastern-RAG-Chatbot` repo is archived. `app.py` / `rag.py` retained for reference only (or deleted).

**Modified**
- Tracker nav: add an "Assistant" link (in `layout.tsx` or the nav component, alongside courses / requirements).
- `.vercelignore`: add `ingestion/`.

## Data Flow (single query, stateless)

1. User types a question on `/assistant`. Category dropdown defaults to **Auto**, or a specific category.
2. Client → `POST /api/assistant` with `{ question, category? }`.
3. Server:
   1. If category is `auto`/absent → `classifyCategory()` returns one of the 8 categories or `unknown` (gpt-4o-mini, structured output).
   2. Embed the question with `text-embedding-3-small` (OpenAI).
   3. Qdrant similarity search, `k=6`, filtered on `metadata.category` equal to the resolved category. If `unknown`, omit the filter (search across all docs).
   4. Build the same category-aware prompt + context as the Python version; call gpt-4o-mini for the answer.
   5. Dedupe source documents by `filename`; return `{ answer, category, categoryName, sources: [{ filename, preview, metadata }] }`.
4. Client renders the answer + a collapsible source list + the category that was used (user can change the dropdown and re-ask if it was misrouted).

## Category Auto-Routing

`classifyCategory(question)` prompts gpt-4o-mini with the 8 category labels +
descriptions and asks for exactly one key or `unknown` (JSON mode / structured
output). `unknown` → no filter (all-category search). If the user explicitly selects
a category, classification is skipped. The answer shows the category that was used
("Category: Visa") so the user can correct a misroute.

The 8 categories (from Python `AVAILABLE_CATEGORIES`):
`arrival`, `billing`, `course`, `employment`, `forms`, `scholarships`, `tuition`, `visa`.

## Dependencies / Environment

**New npm packages**
- `openai` — embeddings + chat
- `@qdrant/js-client-rest` — Qdrant access
- `zod` — request validation + structured classification output

LangChain.js is intentionally NOT used; the logic is small enough that direct SDK
calls are lighter and clearer.

**Environment variables** (Vercel + `.env.local`)
- `OPENAI_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION` (default `northeastern_docs`)

**⚠️ Parity constraint:** the TS query-time embedding model MUST match the model
`ingest.py` used to build the collection (`text-embedding-3-small`). A mismatch
breaks vector dimensionality / similarity.

## Error Handling

- Validate the request body with `zod`: non-empty question; `category` in the known set ∪ `{auto}`.
- Qdrant / OpenAI failures → `502` with a friendly message; the UI shows an error bubble without breaking the transcript.
- Zero retrieval results → still call the LLM (the prompt already instructs "if the context doesn't cover it, say so", preventing hallucination).
- Missing env vars → fail fast at route init with a clear server error; never leak keys.

## Testing (existing Vitest setup)

- **Unit:** `classifyCategory` (mock OpenAI → assert category mapping + `unknown` fallback), prompt builder, source dedup, request validation. Mock OpenAI and Qdrant clients.
- **Integration:** `POST /api/assistant` with a known question against the live Qdrant collection; assert a non-empty answer + returned sources. Opt-in (requires creds), following the existing `vitest.integration.config.mts` pattern.

## Deployment

Same Vercel project. Add the 4 env vars (Production + Preview). `.vercelignore`
excludes `ingestion/`. No new infrastructure. **Prerequisite:** run
`python ingestion/ingest.py` once (with creds) to populate the Qdrant collection.

## Out of Scope (YAGNI)

- Multi-turn conversation memory
- Context-aware integration with the grad plan / live catalog
- Auth / per-user chat-history persistence
- Streaming responses (easy to add later)
- Downloadable source PDFs (needs a hosting decision)
- Automated re-ingestion pipeline (stays a manual Python step)
