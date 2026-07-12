# NEU International Assistant

AI assistant for Northeastern University international students — visas, billing, employment,
arrival, scholarships, forms, tuition, and course registration. Answers are grounded in Office
of Global Services (OGS) documents via Retrieval-Augmented Generation, with a live web-search
fallback to `northeastern.edu`.

Built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. Retrieval uses OpenAI
embeddings + a Qdrant Cloud vector store.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in OPENAI_API_KEY + QDRANT_* values
npm run dev                  # http://localhost:3000
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npx vitest run` — unit + component tests
- `RUN_RAG_INTEGRATION=1 npx vitest run --config vitest.integration.config.mts` — live integration tests

## Documentation

- `CLAUDE.md` — architecture, RAG flow, environment, ingestion.
- `HANDOFF.md` — port history from `neu-cs-tracker` and the planned chat-page redesign.
- `ingestion/` — offline Python pipeline that builds the `northeastern_docs` Qdrant collection.
