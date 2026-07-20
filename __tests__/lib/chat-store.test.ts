import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
import { db } from "@/lib/db";
import { countQuestionsToday, saveExchange } from "@/lib/chat-store";

beforeEach(() => vi.clearAllMocks());

describe("chat-store", () => {
  it("counts today's user messages with the ET day floor", async () => {
    const where = vi.fn().mockResolvedValue([{ count: 3 }]);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where }) } as never);
    const n = await countQuestionsToday("u1", new Date("2026-07-18T03:00:00Z"));
    expect(n).toBe(3);
    expect(where).toHaveBeenCalled(); // floor tested via quota.test; here: query executes
  });

  it("creates a conversation on first exchange and returns its id", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as never);
    const { conversationId } = await saveExchange({
      userId: "u1", expertId: "visa", campus: "boston",
      question: "Do I need a visa?",
      answer: { category: "visa", categoryName: "Visa & Immigration", question: "q",
                answer: "Yes.", sources: [] },
    });
    expect(conversationId).toMatch(/[0-9a-f-]{36}/);
    expect(values).toHaveBeenCalledTimes(3); // conversation + user msg + bot msg
  });
});
