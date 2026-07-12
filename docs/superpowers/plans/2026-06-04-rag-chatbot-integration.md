# RAG Chatbot Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Assistant" feature to the `neu-cs-tracker` Next.js app that answers Northeastern international-student questions via the existing RAG corpus (OpenAI + Qdrant Cloud), replacing the old Streamlit UI.

**Architecture:** The Python RAG query path is reimplemented in TypeScript inside the Next.js app. A single POST route (`/api/assistant`) auto-classifies the question into one of 8 categories (gpt-4o-mini), embeds it (`text-embedding-3-small`), runs a category-filtered Qdrant similarity search, stuffs the retrieved chunks into a category-aware prompt, and returns the answer + deduped sources. Single-shot (stateless). One Vercel deployment; Python `ingest.py` stays offline.

**Tech Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind 4, Vitest 4, `openai`, `@qdrant/js-client-rest`, `zod`.

---

## Parity Constraints (from `Northeastern-RAG-Chatbot/ingest.py` + `rag.py`)

These MUST match the Python ingestion or retrieval breaks:

- **Embedding model:** `text-embedding-3-small` (1536 dims, cosine). The collection was built with this exact model.
- **Vector:** unnamed/default dense vector (collection created with a single `VectorParams`, no named vectors).
- **Payload shape per point:** `{ page_content: string, metadata: { category, filename, folder, source } }` (LangChain `QdrantVectorStore` default keys).
- **Category filter:** Qdrant filter on key `metadata.category` (exact match), `k = 6`, `similarity` search.
- **Categories** (`key → label`): `arrival → Arrival`, `billing → Billing`, `course → Course Registration`, `employment → Employment`, `forms → forms`, `scholarships → Scholarships`, `tuition → Tuition&Fees`, `visa → Visa`.
- **LLM:** `gpt-4o-mini`, `temperature 0.2` for answers.

## File Structure

**Create:**
- `src/lib/rag-categories.ts` — `AVAILABLE_CATEGORIES` map, `Category` type, `CATEGORY_KEYS`, `isCategory()` guard. No external deps (importable anywhere, incl. client UI).
- `src/lib/rag-clients.ts` — lazy `getOpenAI()` / `getQdrant()` singletons + `COLLECTION` const; fail-fast on missing env. Isolating clients here lets tests mock this one module.
- `src/lib/rag.ts` — core: `buildPrompt()`, `dedupeSources()`, `classifyCategory()`, `retrieve()`, `answerQuestion()`, and the `SourceDoc` / `AssistantAnswer` / `RetrievedChunk` types.
- `src/app/api/assistant/route.ts` — `POST` handler (zod validation → `answerQuestion`).
- `src/components/ChatMessage.tsx` — renders one Q/A exchange + sources; exports `ChatEntry` type.
- `src/app/assistant/page.tsx` — chat UI client component.
- `.env.example` — documents the 4 env vars.
- `.vercelignore` — excludes `ingestion/`.
- `ingestion/` — copied `ingest.py`, `requirements.txt`, `northeastern_docs/`, plus `README.md`.

**Modify:**
- `src/app/layout.tsx:38-51` — add the "Assistant" nav link.

**Test:**
- `__tests__/lib/rag-categories.test.ts`
- `__tests__/lib/rag.test.ts`
- `__tests__/api/assistant.test.ts`
- `__tests__/components/ChatMessage.test.tsx`
- `__tests__/integration/assistant.integration.test.ts`

---

## Task 1: Dependencies, env scaffolding, ingestion copy

**Files:**
- Modify: `package.json` (via npm install)
- Create: `.env.example`, `.vercelignore`, `ingestion/README.md`
- Copy: `ingestion/ingest.py`, `ingestion/requirements.txt`, `ingestion/northeastern_docs/`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install openai @qdrant/js-client-rest zod
```
Expected: packages added to `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Create `.env.example`**

```bash
# .env.example — copy to .env.local and fill in
OPENAI_API_KEY=sk-...
QDRANT_URL=https://YOUR-CLUSTER.cloud.qdrant.io:6333
QDRANT_API_KEY=...
QDRANT_COLLECTION=northeastern_docs
```

- [ ] **Step 3: Create `.vercelignore`**

```
ingestion/
```

- [ ] **Step 4: Copy the Python ingestion pipeline into the repo**

Run:
```bash
mkdir -p ingestion
cp ../Northeastern-RAG-Chatbot/ingest.py ingestion/ingest.py
cp ../Northeastern-RAG-Chatbot/requirements.txt ingestion/requirements.txt
cp -R ../Northeastern-RAG-Chatbot/northeastern_docs ingestion/northeastern_docs
```
Expected: `ingestion/` contains `ingest.py`, `requirements.txt`, `northeastern_docs/` with category subfolders.

- [ ] **Step 5: Create `ingestion/README.md`**

```markdown
# Ingestion (offline)

Builds the Qdrant Cloud collection the Assistant queries at runtime. Run only when the PDFs change. NOT deployed (see root `.vercelignore`).

## Run
```bash
cd ingestion
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# set OPENAI_API_KEY, QDRANT_URL, QDRANT_API_KEY in a .env file here
python ingest.py
```

Embeds with `text-embedding-3-small` (1536d, cosine). The runtime query path in `src/lib/rag.ts` MUST use the same embedding model or vectors won't match.
```

- [ ] **Step 6: Verify nothing broke**

Run: `npx vitest run --config vitest.config.mts`
Expected: existing 104 tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example .vercelignore ingestion/
git commit -m "chore: add RAG deps, env example, and offline ingestion pipeline"
```

---

## Task 2: Categories module

**Files:**
- Create: `src/lib/rag-categories.ts`
- Test: `__tests__/lib/rag-categories.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/rag-categories.test.ts
import { describe, it, expect } from "vitest";
import {
  AVAILABLE_CATEGORIES,
  CATEGORY_KEYS,
  isCategory,
} from "@/lib/rag-categories";

describe("rag-categories", () => {
  it("has exactly the 8 ingestion categories", () => {
    expect(CATEGORY_KEYS).toEqual([
      "arrival", "billing", "course", "employment",
      "forms", "scholarships", "tuition", "visa",
    ]);
  });

  it("maps keys to human labels matching ingest.py", () => {
    expect(AVAILABLE_CATEGORIES.visa).toBe("Visa");
    expect(AVAILABLE_CATEGORIES.tuition).toBe("Tuition&Fees");
    expect(AVAILABLE_CATEGORIES.course).toBe("Course Registration");
  });

  it("isCategory accepts known keys and rejects others", () => {
    expect(isCategory("visa")).toBe(true);
    expect(isCategory("auto")).toBe(false);
    expect(isCategory("nonsense")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag-categories.test.ts`
Expected: FAIL — cannot resolve `@/lib/rag-categories`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/rag-categories.ts
/** Category keys + labels — MUST match CATEGORIES in ingestion/ingest.py. */
export const AVAILABLE_CATEGORIES = {
  arrival: "Arrival",
  billing: "Billing",
  course: "Course Registration",
  employment: "Employment",
  forms: "forms",
  scholarships: "Scholarships",
  tuition: "Tuition&Fees",
  visa: "Visa",
} as const;

export type Category = keyof typeof AVAILABLE_CATEGORIES;

export const CATEGORY_KEYS = Object.keys(AVAILABLE_CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(AVAILABLE_CATEGORIES, value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag-categories.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag-categories.ts __tests__/lib/rag-categories.test.ts
git commit -m "feat: add RAG category map and type guard"
```

---

## Task 3: RAG clients (lazy singletons, fail-fast env)

**Files:**
- Create: `src/lib/rag-clients.ts`
- Test: `__tests__/lib/rag-clients.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/rag-clients.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("rag-clients env validation", () => {
  const saved = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...saved }; });

  it("getOpenAI throws a clear error when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const { getOpenAI } = await import("@/lib/rag-clients");
    expect(() => getOpenAI()).toThrow("Missing required env var: OPENAI_API_KEY");
  });

  it("getQdrant throws a clear error when QDRANT_URL is missing", async () => {
    delete process.env.QDRANT_URL;
    const { getQdrant } = await import("@/lib/rag-clients");
    expect(() => getQdrant()).toThrow("Missing required env var: QDRANT_URL");
  });

  it("COLLECTION defaults to northeastern_docs", async () => {
    delete process.env.QDRANT_COLLECTION;
    const { COLLECTION } = await import("@/lib/rag-clients");
    expect(COLLECTION).toBe("northeastern_docs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag-clients.test.ts`
Expected: FAIL — cannot resolve `@/lib/rag-clients`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/rag-clients.ts
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let _openai: OpenAI | null = null;
let _qdrant: QdrantClient | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: required("OPENAI_API_KEY") });
  return _openai;
}

export function getQdrant(): QdrantClient {
  if (!_qdrant) {
    _qdrant = new QdrantClient({
      url: required("QDRANT_URL"),
      apiKey: required("QDRANT_API_KEY"),
    });
  }
  return _qdrant;
}

export const COLLECTION = process.env.QDRANT_COLLECTION || "northeastern_docs";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag-clients.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag-clients.ts __tests__/lib/rag-clients.test.ts
git commit -m "feat: add lazy OpenAI/Qdrant clients with env validation"
```

---

## Task 4: Pure helpers — buildPrompt + dedupeSources

**Files:**
- Create: `src/lib/rag.ts` (initial: types + 2 pure functions)
- Test: `__tests__/lib/rag.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/rag.test.ts
import { describe, it, expect } from "vitest";
import { buildPrompt, dedupeSources } from "@/lib/rag";

describe("buildPrompt", () => {
  it("embeds the category label, context, and question", () => {
    const p = buildPrompt("Visa", "ctx text", "Do I need a passport?");
    expect(p).toContain("specifically answering questions about Visa");
    expect(p).toContain("Context: ctx text");
    expect(p).toContain("Question: Do I need a passport?");
    expect(p.trimEnd().endsWith("Answer:")).toBe(true);
  });
});

describe("dedupeSources", () => {
  it("keeps first occurrence per filename and previews 200 chars", () => {
    const long = "x".repeat(250);
    const out = dedupeSources([
      { content: long, filename: "a.pdf", metadata: { category: "visa" } },
      { content: "second a", filename: "a.pdf", metadata: { category: "visa" } },
      { content: "b body", filename: "b.pdf", metadata: { category: "visa" } },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].filename).toBe("a.pdf");
    expect(out[0].preview).toHaveLength(200);
    expect(out[1].filename).toBe("b.pdf");
    expect(out[1].preview).toBe("b body");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: FAIL — cannot resolve `@/lib/rag`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/rag.ts
import type { Category } from "@/lib/rag-categories";

export interface RetrievedChunk {
  content: string;
  filename: string;
  metadata: Record<string, unknown>;
}

export interface SourceDoc {
  filename: string;
  preview: string;
  metadata: Record<string, unknown>;
}

export interface AssistantAnswer {
  category: Category | "unknown";
  categoryName: string;
  question: string;
  answer: string;
  sources: SourceDoc[];
}

/** Mirrors the RetrievalQA prompt template in rag.py. */
export function buildPrompt(
  categoryLabel: string,
  context: string,
  question: string,
): string {
  return (
    `You are a helpful assistant for Northeastern University international ` +
    `students, specifically answering questions about ${categoryLabel}.\n\n` +
    `Use ALL relevant information from the context. Be specific and ` +
    `comprehensive, include policies, dates, amounts, and procedures when ` +
    `they appear. Synthesize across documents. If the context doesn't ` +
    `cover the question, say so plainly — don't invent details about ` +
    `${categoryLabel}.\n\n` +
    `Context: ${context}\n\n` +
    `Question: ${question}\n\n` +
    `Answer:`
  );
}

/** Dedupe retrieved chunks by filename, keeping a 200-char preview. */
export function dedupeSources(chunks: RetrievedChunk[]): SourceDoc[] {
  const seen = new Set<string>();
  const out: SourceDoc[] = [];
  for (const c of chunks) {
    if (seen.has(c.filename)) continue;
    seen.add(c.filename);
    out.push({
      filename: c.filename,
      preview: c.content.slice(0, 200),
      metadata: c.metadata,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag.ts __tests__/lib/rag.test.ts
git commit -m "feat: add RAG prompt builder and source dedup"
```

---

## Task 5: classifyCategory

**Files:**
- Modify: `src/lib/rag.ts`
- Test: `__tests__/lib/rag.test.ts`

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add this mock at the TOP of `__tests__/lib/rag.test.ts` (above the existing imports), then add the describe block:

```ts
import { vi } from "vitest";
vi.mock("@/lib/rag-clients", () => ({
  getOpenAI: vi.fn(),
  getQdrant: vi.fn(),
  COLLECTION: "test_collection",
}));
import { getOpenAI } from "@/lib/rag-clients";
import { classifyCategory } from "@/lib/rag";

function mockChat(content: string) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  vi.mocked(getOpenAI).mockReturnValue({
    chat: { completions: { create } },
  } as unknown as ReturnType<typeof getOpenAI>);
  return create;
}

describe("classifyCategory", () => {
  it("returns the category key when the model picks a valid one", async () => {
    mockChat('{"category":"visa"}');
    expect(await classifyCategory("F-1 questions?")).toBe("visa");
  });

  it("returns 'unknown' when the model returns an invalid key", async () => {
    mockChat('{"category":"weather"}');
    expect(await classifyCategory("Will it rain?")).toBe("unknown");
  });

  it("returns 'unknown' on unparseable output", async () => {
    mockChat("not json");
    expect(await classifyCategory("???")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: FAIL — `classifyCategory` is not exported.

- [ ] **Step 3: Write the implementation (append to `src/lib/rag.ts`)**

```ts
import { getOpenAI } from "@/lib/rag-clients";
import { AVAILABLE_CATEGORIES, CATEGORY_KEYS, isCategory } from "@/lib/rag-categories";

const CLASSIFIER_MODEL = "gpt-4o-mini";
const ANSWER_MODEL = "gpt-4o-mini";

/** Auto-route a question to one category key, or "unknown" for no filter. */
export async function classifyCategory(question: string): Promise<Category | "unknown"> {
  const list = CATEGORY_KEYS.map((k) => `- ${k}: ${AVAILABLE_CATEGORIES[k]}`).join("\n");
  const completion = await getOpenAI().chat.completions.create({
    model: CLASSIFIER_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content:
          `Classify the student's question into exactly one category key, ` +
          `or "unknown" if none fit.\n\nCategories:\n${list}\n\n` +
          `Question: ${question}\n\n` +
          `Respond with JSON: {"category": "<key or unknown>"}`,
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { category?: string };
    if (parsed.category && isCategory(parsed.category)) return parsed.category;
  } catch {
    /* fall through to unknown */
  }
  return "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: PASS (all rag.ts tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag.ts __tests__/lib/rag.test.ts
git commit -m "feat: add gpt-4o-mini category classifier"
```

---

## Task 6: retrieve

**Files:**
- Modify: `src/lib/rag.ts`
- Test: `__tests__/lib/rag.test.ts`

- [ ] **Step 1: Write the failing test (append)**

Extend the mock to include `getQdrant`, then add the describe block:

```ts
import { getQdrant } from "@/lib/rag-clients";
import { retrieve } from "@/lib/rag";

function mockEmbeddings(vector: number[]) {
  const createEmb = vi.fn().mockResolvedValue({ data: [{ embedding: vector }] });
  const createChat = vi.fn();
  vi.mocked(getOpenAI).mockReturnValue({
    embeddings: { create: createEmb },
    chat: { completions: { create: createChat } },
  } as unknown as ReturnType<typeof getOpenAI>);
  return createEmb;
}

describe("retrieve", () => {
  it("applies a metadata.category filter and maps payloads", async () => {
    mockEmbeddings([0.1, 0.2, 0.3]);
    const search = vi.fn().mockResolvedValue([
      { payload: { page_content: "F-1 info", metadata: { filename: "f1.pdf", category: "visa" } } },
    ]);
    vi.mocked(getQdrant).mockReturnValue({ search } as unknown as ReturnType<typeof getQdrant>);

    const chunks = await retrieve("visa question", "visa");

    expect(search).toHaveBeenCalledWith("test_collection", expect.objectContaining({
      limit: 6,
      with_payload: true,
      filter: { must: [{ key: "metadata.category", match: { value: "visa" } }] },
    }));
    expect(chunks).toEqual([
      { content: "F-1 info", filename: "f1.pdf", metadata: { filename: "f1.pdf", category: "visa" } },
    ]);
  });

  it("omits the filter when category is 'unknown'", async () => {
    mockEmbeddings([0.1]);
    const search = vi.fn().mockResolvedValue([]);
    vi.mocked(getQdrant).mockReturnValue({ search } as unknown as ReturnType<typeof getQdrant>);

    await retrieve("anything", "unknown");

    expect(search).toHaveBeenCalledWith("test_collection", expect.objectContaining({ filter: undefined }));
  });

  it("defaults missing payload fields safely", async () => {
    mockEmbeddings([0.1]);
    const search = vi.fn().mockResolvedValue([{ payload: {} }]);
    vi.mocked(getQdrant).mockReturnValue({ search } as unknown as ReturnType<typeof getQdrant>);

    const chunks = await retrieve("q", "visa");
    expect(chunks[0]).toEqual({ content: "", filename: "Unknown", metadata: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: FAIL — `retrieve` is not exported.

- [ ] **Step 3: Write the implementation (append to `src/lib/rag.ts`)**

```ts
import { getQdrant, COLLECTION } from "@/lib/rag-clients";

const EMBEDDING_MODEL = "text-embedding-3-small"; // MUST match ingest.py
const TOP_K = 6;

/** Embed the question and run a (optionally category-filtered) similarity search. */
export async function retrieve(
  question: string,
  category: Category | "unknown",
): Promise<RetrievedChunk[]> {
  const emb = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: question,
  });
  const vector = emb.data[0].embedding as number[];

  const filter =
    category === "unknown"
      ? undefined
      : { must: [{ key: "metadata.category", match: { value: category } }] };

  const results = await getQdrant().search(COLLECTION, {
    vector,
    limit: TOP_K,
    with_payload: true,
    filter,
  });

  return results.map((r) => {
    const payload = (r.payload ?? {}) as {
      page_content?: string;
      metadata?: Record<string, unknown>;
    };
    const metadata = payload.metadata ?? {};
    return {
      content: payload.page_content ?? "",
      filename: String(metadata.filename ?? "Unknown"),
      metadata,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag.ts __tests__/lib/rag.test.ts
git commit -m "feat: add Qdrant retrieval with category filter"
```

---

## Task 7: answerQuestion orchestrator

**Files:**
- Modify: `src/lib/rag.ts`
- Test: `__tests__/lib/rag.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
import { answerQuestion } from "@/lib/rag";

describe("answerQuestion", () => {
  function mockFull(opts: { classify?: string; answer: string; chunks: unknown[] }) {
    const chat = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ category: opts.classify }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: opts.answer } }] });
    // when category is explicit, only the answer call happens — make create return answer by default too
    const chatExplicit = vi.fn().mockResolvedValue({ choices: [{ message: { content: opts.answer } }] });
    vi.mocked(getOpenAI).mockReturnValue({
      embeddings: { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }) },
      chat: { completions: { create: opts.classify ? chat : chatExplicit } },
    } as unknown as ReturnType<typeof getOpenAI>);
    vi.mocked(getQdrant).mockReturnValue({
      search: vi.fn().mockResolvedValue(opts.chunks),
    } as unknown as ReturnType<typeof getQdrant>);
  }

  it("auto-classifies when no category is given", async () => {
    mockFull({
      classify: "visa",
      answer: "You need an I-20.",
      chunks: [{ payload: { page_content: "I-20 details", metadata: { filename: "i20.pdf", category: "visa" } } }],
    });
    const out = await answerQuestion("F-1 docs?");
    expect(out.category).toBe("visa");
    expect(out.categoryName).toBe("Visa");
    expect(out.answer).toBe("You need an I-20.");
    expect(out.sources).toEqual([
      { filename: "i20.pdf", preview: "I-20 details", metadata: { filename: "i20.pdf", category: "visa" } },
    ]);
  });

  it("uses the explicit category and skips classification", async () => {
    mockFull({ answer: "Billing answer.", chunks: [] });
    const out = await answerQuestion("How do I pay?", "billing");
    expect(out.category).toBe("billing");
    expect(out.categoryName).toBe("Billing");
    expect(out.answer).toBe("Billing answer.");
  });

  it("reports 'All categories' when classification is unknown", async () => {
    mockFull({ classify: "weather", answer: "I'm not sure.", chunks: [] });
    const out = await answerQuestion("random");
    expect(out.category).toBe("unknown");
    expect(out.categoryName).toBe("All categories");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: FAIL — `answerQuestion` is not exported.

- [ ] **Step 3: Write the implementation (append to `src/lib/rag.ts`)**

```ts
/**
 * Single-shot RAG: resolve category (auto-classify if absent) → retrieve →
 * build prompt → generate answer → dedupe sources.
 */
export async function answerQuestion(
  question: string,
  category?: Category,
): Promise<AssistantAnswer> {
  const resolved: Category | "unknown" = category ?? (await classifyCategory(question));

  const chunks = await retrieve(question, resolved);
  const context = chunks.map((c) => c.content).join("\n\n");

  const label =
    resolved === "unknown"
      ? "Northeastern international student topics"
      : AVAILABLE_CATEGORIES[resolved];

  const completion = await getOpenAI().chat.completions.create({
    model: ANSWER_MODEL,
    temperature: 0.2,
    messages: [{ role: "user", content: buildPrompt(label, context, question) }],
  });

  return {
    category: resolved,
    categoryName: resolved === "unknown" ? "All categories" : AVAILABLE_CATEGORIES[resolved],
    question,
    answer: completion.choices[0]?.message?.content ?? "",
    sources: dedupeSources(chunks),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/rag.test.ts`
Expected: PASS (all rag.ts describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag.ts __tests__/lib/rag.test.ts
git commit -m "feat: add answerQuestion RAG orchestrator"
```

---

## Task 8: POST /api/assistant route

**Files:**
- Create: `src/app/api/assistant/route.ts`
- Test: `__tests__/api/assistant.test.ts`

> Next.js 16 note (per AGENTS.md): route handlers differ from older Next. The pattern below matches the existing `src/app/api/courses/route.ts`. If types misbehave, check `node_modules/next/dist/docs/`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/assistant.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rag", () => ({ answerQuestion: vi.fn() }));

import * as rag from "@/lib/rag";
import { POST } from "@/app/api/assistant/route";

function postReq(body: unknown) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/assistant", () => {
  it("returns the answer on success (auto category → undefined)", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "visa", categoryName: "Visa", question: "q", answer: "a", sources: [],
    });
    const res = await POST(postReq({ question: "F-1 docs?" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.answer).toBe("a");
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("F-1 docs?", undefined);
  });

  it("passes an explicit valid category through", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "billing", categoryName: "Billing", question: "q", answer: "a", sources: [],
    });
    await POST(postReq({ question: "pay?", category: "billing" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("pay?", "billing");
  });

  it("treats category 'auto' as undefined", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "unknown", categoryName: "All categories", question: "q", answer: "a", sources: [],
    });
    await POST(postReq({ question: "hi", category: "auto" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("hi", undefined);
  });

  it("returns 400 when question is empty", async () => {
    const res = await POST(postReq({ question: "  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("question is required");
  });

  it("returns 400 for an unknown category", async () => {
    const res = await POST(postReq({ question: "q", category: "weather" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("unknown category: weather");
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(postReq("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 502 when answerQuestion throws", async () => {
    vi.mocked(rag.answerQuestion).mockRejectedValue(new Error("OpenAI down"));
    const res = await POST(postReq({ question: "q" }));
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toBe("OpenAI down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/assistant.test.ts`
Expected: FAIL — cannot resolve `@/app/api/assistant/route`.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/assistant/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/rag";
import { isCategory } from "@/lib/rag-categories";

const BodySchema = z.object({
  question: z.string().trim().min(1, "question is required"),
  category: z.string().optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { question, category } = parsed.data;

  // undefined = auto-classify; a Category = explicit; invalid = 400.
  let resolved: ReturnType<typeof isCategory> extends never ? never : undefined | Parameters<typeof answerQuestion>[1];
  if (!category || category === "auto") {
    resolved = undefined;
  } else if (isCategory(category)) {
    resolved = category;
  } else {
    return NextResponse.json({ error: `unknown category: ${category}` }, { status: 400 });
  }

  try {
    const result = await answerQuestion(question, resolved);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
```

> If the `resolved` type annotation above is awkward in practice, simplify to:
> `let resolved: import("@/lib/rag-categories").Category | undefined;`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/assistant.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assistant/route.ts __tests__/api/assistant.test.ts
git commit -m "feat: add POST /api/assistant route with validation"
```

---

## Task 9: ChatMessage component

**Files:**
- Create: `src/components/ChatMessage.tsx`
- Test: `__tests__/components/ChatMessage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/ChatMessage.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage, type ChatEntry } from "@/components/ChatMessage";

describe("ChatMessage", () => {
  it("renders the question and answer with category and sources", () => {
    const entry: ChatEntry = {
      question: "How do I get an I-20?",
      answer: "Submit financial docs to OGS.",
      categoryName: "Visa",
      sources: [{ filename: "i20.pdf", preview: "..." }],
    };
    render(<ChatMessage entry={entry} />);
    expect(screen.getByText("How do I get an I-20?")).toBeDefined();
    expect(screen.getByText("Submit financial docs to OGS.")).toBeDefined();
    expect(screen.getByText("Visa")).toBeDefined();
    expect(screen.getByText("i20.pdf")).toBeDefined();
  });

  it("shows a thinking state when pending", () => {
    render(<ChatMessage entry={{ question: "q", pending: true }} />);
    expect(screen.getByText(/thinking/i)).toBeDefined();
  });

  it("shows the error when present", () => {
    render(<ChatMessage entry={{ question: "q", error: "OpenAI down" }} />);
    expect(screen.getByText(/OpenAI down/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/ChatMessage.test.tsx`
Expected: FAIL — cannot resolve `@/components/ChatMessage`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ChatMessage.tsx
"use client";

export interface ChatEntry {
  question: string;
  answer?: string;
  categoryName?: string;
  sources?: { filename: string; preview: string }[];
  error?: string;
  pending?: boolean;
}

export function ChatMessage({ entry }: { entry: ChatEntry }) {
  return (
    <div className="space-y-2">
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-red-600 dark:bg-red-500 text-white px-3 py-2 text-sm">
          {entry.question}
        </div>
      </div>

      {/* Assistant response */}
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-lg bg-white dark:bg-[#161c2d] border border-slate-200 dark:border-[#243049] px-3 py-2 text-sm text-slate-900 dark:text-slate-100">
          {entry.pending && <span className="text-slate-400">Thinking…</span>}

          {entry.error && (
            <span className="text-red-600 dark:text-red-400">Error: {entry.error}</span>
          )}

          {entry.answer && (
            <>
              {entry.categoryName && (
                <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Category: {entry.categoryName}
                </div>
              )}
              <p className="whitespace-pre-wrap">{entry.answer}</p>

              {entry.sources && entry.sources.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
                    Sources ({entry.sources.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {entry.sources.map((s) => (
                      <li key={s.filename} className="text-xs">
                        <span className="font-medium">{s.filename}</span>
                        <span className="block text-slate-400 truncate">{s.preview}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/ChatMessage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatMessage.tsx __tests__/components/ChatMessage.test.tsx
git commit -m "feat: add ChatMessage component"
```

---

## Task 10: Assistant page + nav link

**Files:**
- Create: `src/app/assistant/page.tsx`
- Modify: `src/app/layout.tsx:38-51`

- [ ] **Step 1: Add the nav link in `src/app/layout.tsx`**

Inside the existing `<nav className="flex gap-1">` block, after the `/requirements` `<Link>` (around line 50), add:

```tsx
                <Link
                  href="/assistant"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#1e2537] transition-colors"
                >
                  Assistant
                </Link>
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/assistant/page.tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ChatMessage, type ChatEntry } from "@/components/ChatMessage";
import { AVAILABLE_CATEGORIES, CATEGORY_KEYS } from "@/lib/rag-categories";

export default function AssistantPage() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("auto");
  const [busy, setBusy] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const index = entries.length;
    setEntries((e) => [...e, { question, pending: true }]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category }),
      });
      const data = await res.json();
      setEntries((e) =>
        e.map((entry, i) =>
          i === index
            ? res.ok
              ? { question, answer: data.answer, categoryName: data.categoryName, sources: data.sources }
              : { question, error: data.error ?? `HTTP ${res.status}` }
            : entry,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEntries((e) => e.map((entry, i) => (i === index ? { question, error: msg } : entry)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">International Student Assistant</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ask about visas, billing, employment, courses, and more.
        </p>
      </div>

      <div className="space-y-4 min-h-[40vh]">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Ask a question to get started.</p>
        ) : (
          entries.map((entry, i) => <ChatMessage key={i} entry={entry} />)
        )}
      </div>

      <div className="flex items-center gap-2 sticky bottom-4">
        <select
          className="border border-slate-300 dark:border-[#243049] rounded-lg px-2 py-2 text-sm bg-white dark:bg-[#161c2d]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="auto">Auto</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>{AVAILABLE_CATEGORIES[k]}</option>
          ))}
        </select>
        <input
          className="flex-1 border border-slate-300 dark:border-[#243049] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#161c2d] focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={busy}
        />
        <button
          className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg p-2 disabled:opacity-50"
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the app builds and the full unit suite passes**

Run: `npx vitest run --config vitest.config.mts && npm run build`
Expected: all unit tests PASS; build succeeds with `/assistant` and `/api/assistant` in the route list.

- [ ] **Step 4: Manual smoke (requires `.env.local` + populated Qdrant)**

Run: `npm run dev`, open `http://localhost:3000/assistant`, ask "What documents do I need for an F-1 visa?"
Expected: an answer appears with "Category: Visa" and a Sources disclosure.

- [ ] **Step 5: Commit**

```bash
git add src/app/assistant/page.tsx src/app/layout.tsx
git commit -m "feat: add Assistant chat page and nav link"
```

---

## Task 11: Opt-in integration test

**Files:**
- Create: `__tests__/integration/assistant.integration.test.ts`

> Follows the existing `__tests__/integration/*.integration.test.ts` pattern (live HTTP against a running dev server). Gated behind `RUN_RAG_INTEGRATION=1` so it never burns OpenAI credits in normal runs.

- [ ] **Step 1: Write the test**

```ts
// __tests__/integration/assistant.integration.test.ts
import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const RUN = process.env.RUN_RAG_INTEGRATION === "1";

describe.skipIf(!RUN)("POST /api/assistant (live)", () => {
  it("answers a known visa question with sources", async () => {
    const res = await fetch(`${BASE}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What documents do I need for an F-1 visa?" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.answer).toBe("string");
    expect(data.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(data.sources)).toBe(true);
  });

  it("validates empty questions", async () => {
    const res = await fetch(`${BASE}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it (gated — expect skipped without the flag)**

Run: `npm run test:integration`
Expected: the new suite is SKIPPED (no `RUN_RAG_INTEGRATION`). Existing integration tests behave as before.

- [ ] **Step 3: Optionally run live**

Run (with dev server up + `.env.local` set + Qdrant populated):
```bash
RUN_RAG_INTEGRATION=1 npm run test:integration
```
Expected: 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/assistant.integration.test.ts
git commit -m "test: add opt-in Assistant integration test"
```

---

## Self-Review

**Spec coverage** (against `2026-06-04-rag-chatbot-integration-design.md`):
- Chatbot as a tracker feature → Tasks 9–10 (page + nav). ✅
- Port query to TypeScript → Tasks 4–7. ✅
- Merge into tracker repo; ingestion under `ingestion/`, `.vercelignore`'d → Task 1. ✅
- Auto-route + manual override + `unknown` fallback → Task 5 (classifier), Task 7 (orchestration), Task 10 (dropdown). ✅
- Single-shot stateless → `answerQuestion` takes only `(question, category?)`; route is stateless. ✅
- Non-streaming JSON (v1) → route returns one JSON payload. ✅
- Sources = filename + preview + metadata, no PDF download → `dedupeSources` / `SourceDoc`. ✅
- Env vars + parity constraint → Tasks 1, 3, 6 (embedding model const + comment). ✅
- Error handling (400 validation, 502 upstream, friendly UI) → Task 8 + ChatMessage error state. ✅
- Testing: unit (Tasks 2–9) + opt-in integration (Task 11). ✅

**Placeholder scan:** No TBD/TODO; every code step contains complete code. The one annotated simplification (Task 8 `resolved` type) gives an explicit fallback line.

**Type consistency:** `Category`, `RetrievedChunk`, `SourceDoc`, `AssistantAnswer`, `ChatEntry` are defined once and reused. `answerQuestion(question, category?)`, `retrieve(question, category)`, `classifyCategory(question)`, `dedupeSources(chunks)`, `buildPrompt(label, context, question)` signatures are consistent across tasks and tests. Qdrant payload keys (`page_content`, `metadata.filename`, `metadata.category`) match `ingest.py`.
