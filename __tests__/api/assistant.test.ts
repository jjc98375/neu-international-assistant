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
});
