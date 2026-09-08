// __tests__/api/assistant.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rag", () => ({ answerQuestion: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/chat-store", () => ({
  countQuestionsToday: vi.fn(), getActiveSubscriptions: vi.fn().mockResolvedValue([]),
  saveExchange: vi.fn().mockResolvedValue({ conversationId: "c1" }),
}));

import * as rag from "@/lib/rag";
import { auth } from "@/lib/auth";
import * as store from "@/lib/chat-store";
import { POST } from "@/app/api/assistant/route";

function postReq(body: unknown) {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BETTER_AUTH_SECRET = "test-secret";
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  vi.mocked(store.countQuestionsToday).mockResolvedValue(0);
  vi.mocked(store.getActiveSubscriptions).mockResolvedValue([]);
  vi.mocked(store.saveExchange).mockResolvedValue({ conversationId: "c1" });
});

describe("POST /api/assistant", () => {
  it("returns the answer on success (auto category → undefined)", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "visa", categoryName: "Visa", question: "q", answer: "a", sources: [],
    });
    const res = await POST(postReq({ question: "F-1 docs?" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.answer).toBe("a");
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("F-1 docs?", undefined, undefined);
  });

  it("passes an explicit valid category through", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "billing", categoryName: "Billing", question: "q", answer: "a", sources: [],
    });
    await POST(postReq({ question: "pay?", category: "billing" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("pay?", "billing", undefined);
  });

  it("treats category 'auto' as undefined", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "unknown", categoryName: "All categories", question: "q", answer: "a", sources: [],
    });
    await POST(postReq({ question: "hi", category: "auto" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("hi", undefined, undefined);
  });

  it("passes a valid campus through and treats 'all' as undefined", async () => {
    vi.mocked(rag.answerQuestion).mockResolvedValue({
      category: "scholarships", categoryName: "Scholarships", question: "q", answer: "a", sources: [],
    });
    await POST(postReq({ question: "aid?", category: "scholarships", campus: "toronto" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenCalledWith("aid?", "scholarships", "toronto");

    await POST(postReq({ question: "aid?", category: "scholarships", campus: "all" }));
    expect(vi.mocked(rag.answerQuestion)).toHaveBeenLastCalledWith("aid?", "scholarships", undefined);
  });

  it("returns 400 for an unknown campus", async () => {
    const res = await POST(postReq({ question: "q", campus: "mars" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown campus: mars");
  });

  it("returns 400 when question is empty", async () => {
    const res = await POST(postReq({ question: "  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("question is required");
  });

  it("returns 400 when question exceeds 2000 chars", async () => {
    const res = await POST(postReq({ question: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("question too long");
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

  it("gates the 3rd anonymous question with 401", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    process.env.BETTER_AUTH_SECRET = "test-secret";
    const { serializeAnonCookie } = await import("@/lib/gate");
    const cookie = serializeAnonCookie(2).split(";")[0];
    const res = await POST(new Request("http://l/api/assistant", {
      method: "POST", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ question: "q3" }) }));
    expect(res.status).toBe(401);
    expect((await res.json()).gate).toBe(true);
  });

  it("answers anonymous question 1 and sets the incremented cookie", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
      question: "q", answer: "a", sources: [] });
    const res = await POST(postReq({ question: "q1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("neu_anon=1.");
    expect((await res.json()).usage).toEqual({ used: 1, limit: 2, tier: "anon" });
  });

  it("blocks a free user at 10 with 429 + usage payload", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.countQuestionsToday).mockResolvedValue(10);
    const res = await POST(postReq({ question: "q" }));
    expect(res.status).toBe(429);
    expect((await res.json()).usage).toEqual({ used: 10, limit: 10, tier: "free" });
  });

  it("persists and returns conversationId + usage for a logged-in user", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.countQuestionsToday).mockResolvedValue(0);
    vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
      question: "q", answer: "a", sources: [] });
    const res = await POST(postReq({ question: "q", expertId: "visa" }));
    const data = await res.json();
    expect(data.conversationId).toBe("c1");
    expect(data.usage).toEqual({ used: 1, limit: 10, tier: "free" });
  });

  it("derives expertId from the RAG category when the client omits it", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.countQuestionsToday).mockResolvedValue(0);
    vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "billing", categoryName: "Billing",
      question: "q", answer: "a", sources: [] });
    await POST(postReq({ question: "how much do I owe?" }));
    expect(store.saveExchange).toHaveBeenCalledWith(
      expect.objectContaining({ expertId: "billing" }));
  });

  it("does not count the question against the quota when persistence fails", async () => {
    // saveExchange writes the `messages` row that countQuestionsToday reads,
    // so a failed write means the question was never actually counted —
    // reporting used+1 leaves the HUD one ahead of the truth until the next
    // request corrects it.
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.countQuestionsToday).mockResolvedValue(3);
    vi.mocked(store.saveExchange).mockRejectedValue(new Error("neon unreachable"));
    vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
      question: "q", answer: "a", sources: [] });

    const res = await POST(postReq({ question: "q" }));
    const data = await res.json();

    // The answer still goes out — a persistence failure must not cost the
    // student their answer.
    expect(res.status).toBe(200);
    expect(data.answer).toBe("a");
    expect(data.usage).toEqual({ used: 3, limit: 10, tier: "free" });
  });

  it("returns a JSON 503 when the quota lookup itself fails", async () => {
    // These two reads sat outside the try block, so a database outage escaped
    // as an unhandled rejection and Next answered with an HTML 500 — breaking
    // the JSON error contract every client path is written against.
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.getActiveSubscriptions).mockRejectedValue(new Error("neon unreachable"));

    const res = await POST(postReq({ question: "q" }));
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toBe("quota_unavailable");
    // Fails closed: no answer is generated when entitlement can't be checked.
    expect(rag.answerQuestion).not.toHaveBeenCalled();
  });

  it("still counts the question when persistence succeeds", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(store.countQuestionsToday).mockResolvedValue(3);
    vi.mocked(rag.answerQuestion).mockResolvedValue({ category: "visa", categoryName: "V",
      question: "q", answer: "a", sources: [] });

    const res = await POST(postReq({ question: "q" }));
    const data = await res.json();

    expect(data.usage).toEqual({ used: 4, limit: 10, tier: "free" });
  });
});
