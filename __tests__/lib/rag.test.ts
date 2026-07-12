// __tests__/lib/rag.test.ts
import { vi } from "vitest";
vi.mock("@/lib/rag-clients", () => ({
  getOpenAI: vi.fn(),
  getQdrant: vi.fn(),
  COLLECTION: "test_collection",
}));
import { getOpenAI } from "@/lib/rag-clients";
import { classifyCategory } from "@/lib/rag";
import { describe, it, expect } from "vitest";
import { buildPrompt, dedupeSources } from "@/lib/rag";

function mockChat(content: string) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });
  vi.mocked(getOpenAI).mockReturnValue({
    chat: { completions: { create } },
  } as unknown as ReturnType<typeof getOpenAI>);
  return create;
}

describe("buildPrompt", () => {
  it("embeds the category label, context, and question", () => {
    const p = buildPrompt("Visa", "ctx text", "Do I need a passport?");
    expect(p).toContain("specifically answering questions about Visa");
    expect(p).toContain("Context: ctx text");
    expect(p).toContain("Question: Do I need a passport?");
    // asks the model to self-report grounding via JSON (drives the web fallback)
    expect(p).toContain('"answered"');
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

  it("falls back to an unfiltered search when the filtered top score is weak", async () => {
    // Mirrors the real misroute: "apply for OPT" classified as visa scores ~0.43
    // under the visa filter, but the OPT doc scores ~0.71 unfiltered.
    mockEmbeddings([0.1]);
    const search = vi.fn()
      .mockResolvedValueOnce([
        { score: 0.43, payload: { page_content: "visa stuff", metadata: { filename: "visa.pdf", category: "visa" } } },
      ])
      .mockResolvedValueOnce([
        { score: 0.71, payload: { page_content: "opt stuff", metadata: { filename: "opt.pdf", category: "employment" } } },
      ]);
    vi.mocked(getQdrant).mockReturnValue({ search } as unknown as ReturnType<typeof getQdrant>);

    const chunks = await retrieve("how do I apply for OPT", "visa");

    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1][1]).toMatchObject({ filter: undefined });
    expect(chunks[0].filename).toBe("opt.pdf");
  });

  it("does not fall back when the filtered top score is healthy", async () => {
    mockEmbeddings([0.1]);
    const search = vi.fn().mockResolvedValue([
      { score: 0.72, payload: { page_content: "sevis", metadata: { filename: "sevis.pdf", category: "visa" } } },
    ]);
    vi.mocked(getQdrant).mockReturnValue({ search } as unknown as ReturnType<typeof getQdrant>);

    const chunks = await retrieve("what is the SEVIS fee", "visa");

    expect(search).toHaveBeenCalledTimes(1);
    expect(chunks[0].filename).toBe("sevis.pdf");
  });
});

import { answerQuestion, searchWeb } from "@/lib/rag";

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

  it("falls back to a live web search when the top retrieval score is below the web floor", async () => {
    // tuition-type question: classifier picks billing, but no doc scores well (~0.4).
    const chat = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ category: "billing" }) } }],
    });
    const responsesCreate = vi.fn().mockResolvedValue({
      output_text: "MSCS tuition is approximately $X per credit hour.",
      output: [
        { type: "web_search_call" },
        {
          type: "message",
          content: [
            {
              annotations: [
                { type: "url_citation", url: "https://studentfinance.northeastern.edu/tuition/", title: "Tuition - SFS" },
              ],
            },
          ],
        },
      ],
    });
    vi.mocked(getOpenAI).mockReturnValue({
      embeddings: { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }) },
      chat: { completions: { create: chat } },
      responses: { create: responsesCreate },
    } as unknown as ReturnType<typeof getOpenAI>);
    vi.mocked(getQdrant).mockReturnValue({
      search: vi.fn().mockResolvedValue([
        { score: 0.4, payload: { page_content: "weak", metadata: { filename: "weak.pdf", category: "billing" } } },
      ]),
    } as unknown as ReturnType<typeof getQdrant>);

    const out = await answerQuestion("How much is the CS master's tuition?");

    expect(responsesCreate).toHaveBeenCalled();
    expect(out.viaWeb).toBe(true);
    expect(out.answer).toContain("per credit");
    expect(out.sources[0].filename).toBe("Tuition - SFS");
    expect(out.sources[0].preview).toBe("https://studentfinance.northeastern.edu/tuition/");
  });

  it("web-falls back when a doc is retrieved but the model can't answer from it", async () => {
    // The tuition case: a fee doc scores fine (0.6) so the score gate doesn't fire,
    // but the answer model reports answered:false → still fall back to web.
    const chat = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ category: "tuition" }) } }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ answered: false, answer: "The context doesn't list the per-credit rate." }) } }],
      });
    const responsesCreate = vi.fn().mockResolvedValue({
      output_text: "MSCS tuition is about $X per credit hour.",
      output: [
        { type: "message", content: [{ annotations: [{ type: "url_citation", url: "https://studentfinance.northeastern.edu/", title: "SFS" }] }] },
      ],
    });
    vi.mocked(getOpenAI).mockReturnValue({
      embeddings: { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }) },
      chat: { completions: { create: chat } },
      responses: { create: responsesCreate },
    } as unknown as ReturnType<typeof getOpenAI>);
    vi.mocked(getQdrant).mockReturnValue({
      search: vi.fn().mockResolvedValue([
        { score: 0.6, payload: { page_content: "fee descriptions", metadata: { filename: "fees.pdf", category: "tuition" } } },
      ]),
    } as unknown as ReturnType<typeof getQdrant>);

    const out = await answerQuestion("How much is MSCS tuition per credit?");

    expect(responsesCreate).toHaveBeenCalled();
    expect(out.viaWeb).toBe(true);
    expect(out.answer).toContain("per credit");
    expect(out.sources[0].filename).toBe("SFS");
  });

  it("does NOT web-fall back when retrieval is confident", async () => {
    const responsesCreate = vi.fn();
    const chat = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ category: "employment" }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Apply via myOGS." } }] });
    vi.mocked(getOpenAI).mockReturnValue({
      embeddings: { create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }) },
      chat: { completions: { create: chat } },
      responses: { create: responsesCreate },
    } as unknown as ReturnType<typeof getOpenAI>);
    vi.mocked(getQdrant).mockReturnValue({
      search: vi.fn().mockResolvedValue([
        { score: 0.71, payload: { page_content: "opt", metadata: { filename: "opt.pdf", category: "employment" } } },
      ]),
    } as unknown as ReturnType<typeof getQdrant>);

    const out = await answerQuestion("How do I apply for OPT?");

    expect(responsesCreate).not.toHaveBeenCalled();
    expect(out.viaWeb).toBeFalsy();
    expect(out.answer).toBe("Apply via myOGS.");
  });
});

describe("searchWeb", () => {
  it("searches northeastern.edu and returns the answer plus deduped url citations", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: "Tuition is about $1,800 per credit hour.",
      output: [
        { type: "web_search_call" },
        {
          type: "message",
          content: [
            {
              annotations: [
                { type: "url_citation", url: "https://studentfinance.northeastern.edu/", title: "SFS" },
                { type: "url_citation", url: "https://studentfinance.northeastern.edu/", title: "dup-same-url" },
                { type: "url_citation", url: "https://www.khoury.northeastern.edu/", title: "Khoury" },
              ],
            },
          ],
        },
      ],
    });
    vi.mocked(getOpenAI).mockReturnValue({
      responses: { create },
    } as unknown as ReturnType<typeof getOpenAI>);

    const out = await searchWeb("How much is MSCS tuition?");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [{ type: "web_search", filters: { allowed_domains: ["northeastern.edu"] } }],
      }),
    );
    expect(out.answer).toContain("per credit");
    // deduped by URL, in order
    expect(out.sources.map((s) => s.filename)).toEqual(["SFS", "Khoury"]);
    expect(out.sources[0].preview).toBe("https://studentfinance.northeastern.edu/");
  });
});

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

  it("gives the model routing guidance for ambiguous work-authorization terms", async () => {
    const create = mockChat('{"category":"employment"}');
    await classifyCategory("how do I apply for OPT?");
    const sent = create.mock.calls[0][0].messages[0].content as string;
    // OPT/CPT/work authorization must be steered to employment, not visa.
    // Assert on "CPT" (absent from the question) so this only passes when the
    // prompt itself carries explicit routing guidance, not the echoed question.
    expect(sent).toContain("CPT");
    expect(sent).toMatch(/work authorization|employment authorization/i);
  });
});
