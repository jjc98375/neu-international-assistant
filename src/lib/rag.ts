// src/lib/rag.ts
import type { Category } from "@/lib/rag-categories";
import { getOpenAI, getQdrant, COLLECTION } from "@/lib/rag-clients";
import { AVAILABLE_CATEGORIES, CATEGORY_KEYS, isCategory } from "@/lib/rag-categories";

export interface RetrievedChunk {
  content: string;
  filename: string;
  metadata: Record<string, unknown>;
  /** Cosine similarity from Qdrant; undefined when not provided (e.g. in tests). */
  score?: number;
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
  /** True when the answer came from a live web search instead of the indexed corpus. */
  viaWeb?: boolean;
}

/**
 * Category-aware answer prompt. Asks the model to BOTH answer and self-report,
 * via JSON, whether the context actually contained the answer — `answered:false`
 * is what triggers the live web fallback in answerQuestion().
 */
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
    `they appear. Synthesize across documents. Never invent details about ` +
    `${categoryLabel}.\n\n` +
    `Respond as JSON: {"answered": boolean, "answer": string}. Set ` +
    `"answered" to false when the context does NOT contain the specific ` +
    `information the question asks for (e.g. a figure, rate, or policy that ` +
    `simply isn't present) — even if the context is on the same topic — and ` +
    `briefly say so in "answer". Otherwise set it to true.\n\n` +
    `Context: ${context}\n\n` +
    `Question: ${question}`
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

const CLASSIFIER_MODEL = "gpt-4o-mini";
const ANSWER_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small"; // MUST match ingest.py
const TOP_K = 6;
// If a category-filtered search's best match scores below this cosine floor, the
// classifier likely misrouted the question (e.g. "apply for OPT" → visa scores ~0.43
// while the OPT doc scores ~0.71 unfiltered). Below the floor we retry without the
// filter so a wrong category can't hide an otherwise-strong document.
const SCORE_FLOOR = 0.5;
// When even the best (unfiltered) retrieved chunk scores below this floor, the corpus
// has no good answer (measured: "MSCS tuition" tops out ~0.42 vs ~0.7 for covered
// topics). We then fall back to a live, domain-restricted web search.
const WEB_FALLBACK_FLOOR = 0.5;
// Domain `filters` on the web_search tool are rejected by the *-mini chat models
// (gpt-4o-mini/gpt-4.1-mini → 400); gpt-5-mini is the cheapest model that supports them.
const WEB_SEARCH_MODEL = "gpt-5-mini";
const WEB_ALLOWED_DOMAINS = ["northeastern.edu"];
const WEB_CATEGORY_LABEL = "Live web · northeastern.edu";

// Minimal shapes for reading the Responses API web-search output (SDK types are broad).
interface UrlCitation {
  type: string;
  url: string;
  title?: string;
}
interface WebOutputPart {
  annotations?: UrlCitation[];
}
interface WebOutputItem {
  type: string;
  content?: WebOutputPart[];
}

interface ScoredResult {
  score?: number;
  payload?: { page_content?: string; metadata?: Record<string, unknown> };
}

function buildFilter(category: Category | "unknown") {
  return category === "unknown"
    ? undefined
    : { must: [{ key: "metadata.category", match: { value: category } }] };
}

function mapResults(results: ScoredResult[]): RetrievedChunk[] {
  return results.map((r) => {
    const payload = r.payload ?? {};
    const metadata = payload.metadata ?? {};
    return {
      content: payload.page_content ?? "",
      filename: String(metadata.filename ?? "Unknown"),
      metadata,
      score: r.score,
    };
  });
}

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
          `Routing guidance for commonly-confused topics:\n` +
          `- Any work authorization — OPT, STEM OPT, CPT, co-op, on-campus jobs, ` +
          `assistantships, employment authorization — goes to "employment", NOT "visa".\n` +
          `- "visa" is for the consular/entry process only: visa interviews, DS-160, ` +
          `consulate appointments, SEVIS fee, port of entry.\n` +
          `- Health insurance / NUSHP, fees, and payments go to "billing" or "tuition".\n\n` +
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

  // LangChain-Qdrant stores each point as { page_content: string, metadata: { filename, category, … } };
  // the dot-path filter key "metadata.category" matches that nested payload (parity with ingestion/ingest.py).
  const filtered = (await getQdrant().search(COLLECTION, {
    vector,
    limit: TOP_K,
    with_payload: true,
    filter: buildFilter(category),
  })) as ScoredResult[];

  // Low-confidence fallback: when a category filter was applied but its best match
  // is weak (or empty), the classifier likely misrouted — retry unfiltered and keep
  // whichever surfaced the stronger top match.
  if (category !== "unknown") {
    const topScore = typeof filtered[0]?.score === "number" ? filtered[0].score : undefined;
    const weak = filtered.length === 0 || (topScore !== undefined && topScore < SCORE_FLOOR);
    if (weak) {
      const unfiltered = (await getQdrant().search(COLLECTION, {
        vector,
        limit: TOP_K,
        with_payload: true,
        filter: undefined,
      })) as ScoredResult[];
      const unfilteredTop =
        typeof unfiltered[0]?.score === "number" ? unfiltered[0].score : undefined;
      const better =
        unfiltered.length > 0 &&
        (topScore === undefined ||
          (unfilteredTop !== undefined && unfilteredTop >= topScore));
      if (better) return mapResults(unfiltered);
    }
  }

  return mapResults(filtered);
}

/**
 * Live fallback: when the corpus has no good answer, search the open web through
 * OpenAI's Responses web-search tool, restricted to northeastern.edu, and return
 * the synthesized answer plus its (deduped) URL citations as sources.
 */
export async function searchWeb(
  question: string,
): Promise<{ answer: string; sources: SourceDoc[] }> {
  const res = await getOpenAI().responses.create({
    model: WEB_SEARCH_MODEL,
    tools: [{ type: "web_search", filters: { allowed_domains: WEB_ALLOWED_DOMAINS } }],
    input:
      `You are helping a Northeastern University international student. Answer the ` +
      `question using current, official Northeastern information. Be specific and ` +
      `cite figures, dates, and procedures when available. If you cannot find it, ` +
      `say so plainly.\n\nQuestion: ${question}`,
  } as Parameters<ReturnType<typeof getOpenAI>["responses"]["create"]>[0]);

  const answer = (res as { output_text?: string }).output_text ?? "";

  const sources: SourceDoc[] = [];
  const seen = new Set<string>();
  const output = ((res as { output?: WebOutputItem[] }).output ?? []);
  for (const item of output) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      for (const ann of part.annotations ?? []) {
        if (ann.type === "url_citation" && ann.url && !seen.has(ann.url)) {
          seen.add(ann.url);
          sources.push({
            filename: ann.title || ann.url,
            preview: ann.url,
            metadata: { url: ann.url, source: "web" },
          });
        }
      }
    }
  }
  return { answer, sources };
}

/**
 * Single-shot RAG: resolve category (auto-classify if absent) → retrieve →
 * build prompt → generate answer → dedupe sources. When the indexed corpus has
 * no confident match, fall back to a live web search (northeastern.edu).
 */
export async function answerQuestion(
  question: string,
  category?: Category,
): Promise<AssistantAnswer> {
  const resolved: Category | "unknown" = category ?? (await classifyCategory(question));

  const chunks = await retrieve(question, resolved);

  // Helper: run the live web fallback, returning a full answer or null if it can't help.
  const webFallback = async (): Promise<AssistantAnswer | null> => {
    try {
      const web = await searchWeb(question);
      if (!web.answer.trim()) return null;
      return {
        category: resolved,
        categoryName: WEB_CATEGORY_LABEL,
        question,
        answer: web.answer,
        sources: web.sources,
        viaWeb: true,
      };
    } catch {
      return null; // web search unavailable — degrade to the corpus answer
    }
  };

  // Trigger 1 — no confident document at all (best chunk scores below the floor).
  // Guarded on a defined score so unit tests with score-less mocks keep the RAG path.
  const topScore = chunks[0]?.score;
  if (topScore !== undefined && topScore < WEB_FALLBACK_FLOOR) {
    const web = await webFallback();
    if (web) return web;
  }

  const context = chunks.map((c) => c.content).join("\n\n");
  const label =
    resolved === "unknown"
      ? "Northeastern international student topics"
      : AVAILABLE_CATEGORIES[resolved];

  const completion = await getOpenAI().chat.completions.create({
    model: ANSWER_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(label, context, question) }],
  });
  const { answer, answered } = parseGroundedAnswer(
    completion.choices[0]?.message?.content ?? "",
  );

  // Trigger 2 — a doc was retrieved but the model says the context doesn't actually
  // contain the answer (on-topic but missing the figure/policy). Fall back to web.
  if (!answered) {
    const web = await webFallback();
    if (web) return web;
  }

  return {
    category: resolved,
    categoryName: resolved === "unknown" ? "All categories" : AVAILABLE_CATEGORIES[resolved],
    question,
    answer,
    sources: dedupeSources(chunks),
  };
}

/**
 * Parse the answer model's JSON ({answered, answer}). Falls back gracefully to
 * treating the raw text as a grounded answer when it isn't valid JSON (keeps
 * older/plain responses — and unit-test mocks — working).
 */
export function parseGroundedAnswer(raw: string): { answer: string; answered: boolean } {
  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; answered?: unknown };
    if (typeof parsed.answer === "string") {
      return { answer: parsed.answer, answered: parsed.answered !== false };
    }
  } catch {
    /* not JSON — treat as a plain grounded answer */
  }
  return { answer: raw, answered: true };
}
