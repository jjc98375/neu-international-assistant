import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { GET as listGET, POST as importPOST } from "@/app/api/conversations/route";
import { PATCH, DELETE } from "@/app/api/conversations/[id]/route";
import { GET as messagesGET } from "@/app/api/conversations/[id]/messages/route";

beforeEach(() => vi.clearAllMocks());

// Next 16: dynamic route params are a Promise.
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function postReq(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/conversations", () => {
  it("401s when logged out", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await listGET(new Request("http://l/api/conversations"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("login_required");
  });

  it("lists pinned conversations first (route returns as-is; ordering is SQL-side)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    const rows = [
      { id: "a", pinned: false, updatedAt: new Date("2026-07-18") },
      { id: "b", pinned: true, updatedAt: new Date("2026-07-01") },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => ({ orderBy }) }) } as never);
    const res = await listGET(new Request("http://l/api/conversations"));
    const data = await res.json();
    expect(data.conversations.map((c: { id: string }) => c.id)).toEqual(["a", "b"]);
    expect(orderBy).toHaveBeenCalled();
  });
});

describe("POST /api/conversations (anonymous-history import)", () => {
  it("401s when logged out", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await importPOST(postReq("http://l/api/conversations", { title: "t" }));
    expect(res.status).toBe(401);
  });

  it("creates a conversation and inserts each message, returning its id", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    const values = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values } as never);

    const res = await importPOST(
      postReq("http://l/api/conversations", {
        expertId: "visa",
        campus: "boston",
        title: "Do I need a visa?",
        messages: [
          { role: "user", content: "Do I need a visa?" },
          { role: "bot", content: "Yes.", categoryName: "Visa", viaWeb: true, sources: [{ title: "x" }] },
        ],
      }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toMatch(/[0-9a-f-]{36}/);
    expect(values).toHaveBeenCalledTimes(3); // conversation + 2 messages
  });
});

describe("PATCH /api/conversations/:id", () => {
  it("401s when logged out", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await PATCH(postReq("http://l", { pinned: true }, "PATCH"), ctx("x"));
    expect(res.status).toBe(401);
  });

  it("404s a PATCH on a conversation the caller does not own", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) } as never);
    const res = await PATCH(postReq("http://l", { pinned: true }, "PATCH"), ctx("x"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("toggles pinned for an owned row", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: "convo-1" }]) }),
    } as never);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set } as never);

    const res = await PATCH(postReq("http://l", { pinned: true }, "PATCH"), ctx("convo-1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(set).toHaveBeenCalledWith({ pinned: true });
    expect(updateWhere).toHaveBeenCalled();
  });
});

describe("DELETE /api/conversations/:id", () => {
  it("401s when logged out", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(postReq("http://l", undefined, "DELETE"), ctx("x"));
    expect(res.status).toBe(401);
  });

  it("404s a DELETE on a conversation the caller does not own", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) } as never);
    const res = await DELETE(postReq("http://l", undefined, "DELETE"), ctx("x"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("deletes messages then the conversation for an owned row", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: "convo-1" }]) }),
    } as never);
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as never);

    const res = await DELETE(postReq("http://l", undefined, "DELETE"), ctx("convo-1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(db.delete).toHaveBeenCalledTimes(2);
    // messages deleted first, then the conversation itself
    expect(vi.mocked(db.delete).mock.calls[0][0]).toBe(messages);
    expect(vi.mocked(db.delete).mock.calls[1][0]).toBe(conversations);
  });
});

describe("GET /api/conversations/:id/messages", () => {
  it("401s when logged out", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await messagesGET(new Request("http://l"), ctx("x"));
    expect(res.status).toBe(401);
  });

  it("404s when the conversation is not owned by the caller", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(db.select).mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) } as never);
    const res = await messagesGET(new Request("http://l"), ctx("x"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("returns messages in chronological order for an owned conversation", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never);
    const msgRows = [
      { role: "user", content: "hi", categoryName: null, viaWeb: false, sources: null, createdAt: new Date("2026-07-01") },
      { role: "bot", content: "hello", categoryName: "Visa", viaWeb: false, sources: null, createdAt: new Date("2026-07-02") },
    ];
    const orderBy = vi.fn().mockResolvedValue(msgRows);
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: "convo-1" }]) }) } as never)
      .mockReturnValueOnce({ from: () => ({ where: () => ({ orderBy }) }) } as never);

    const res = await messagesGET(new Request("http://l"), ctx("convo-1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0].content).toBe("hi");
    expect(orderBy).toHaveBeenCalled();
  });
});
