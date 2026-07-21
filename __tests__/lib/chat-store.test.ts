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

  it("writes into a supplied conversationId when it's owned by the user", async () => {
    const selectWhere = vi.fn().mockResolvedValue([{ id: "convo-owned" }]);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: selectWhere }) } as never);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set } as never);
    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const { conversationId } = await saveExchange({
      userId: "u1", conversationId: "convo-owned", expertId: "visa", campus: "boston",
      question: "Do I need a visa?",
      answer: { category: "visa", categoryName: "Visa & Immigration", question: "q",
                answer: "Yes.", sources: [] },
    });

    expect(conversationId).toBe("convo-owned");
    expect(db.update).toHaveBeenCalledTimes(1); // update, not insert-conversation
    expect(values).toHaveBeenCalledTimes(2); // user msg + bot msg only
  });

  it("falls back to creating a new conversation when the supplied id isn't owned by the user (IDOR)", async () => {
    const selectWhere = vi.fn().mockResolvedValue([]); // not found / not owned
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: selectWhere }) } as never);
    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const { conversationId } = await saveExchange({
      userId: "u1", conversationId: "someone-elses-convo", expertId: "visa", campus: "boston",
      question: "Do I need a visa?",
      answer: { category: "visa", categoryName: "Visa & Immigration", question: "q",
                answer: "Yes.", sources: [] },
    });

    expect(conversationId).not.toBe("someone-elses-convo");
    expect(conversationId).toMatch(/[0-9a-f-]{36}/);
    expect(db.update).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledTimes(3); // new conversation + user msg + bot msg
  });
});
