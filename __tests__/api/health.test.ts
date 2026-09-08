// __tests__/api/health.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rag-clients", () => ({
  getQdrant: vi.fn(),
  COLLECTION: "test_collection",
}));

import { getQdrant } from "@/lib/rag-clients";
import { GET } from "@/app/api/health/route";

const getCollection = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQdrant).mockReturnValue({ getCollection } as never);
});

describe("GET /api/health", () => {
  it("reports ok with the collection's point count when Qdrant answers", async () => {
    getCollection.mockResolvedValue({ status: "green", points_count: 930 });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, collection: "green", points: 930 });
    expect(getCollection).toHaveBeenCalledWith("test_collection");
  });

  it("returns 503 when Qdrant is unreachable", async () => {
    // The failure mode this endpoint exists to catch: the free-tier cluster is
    // reaped and every corpus query starts failing.
    getCollection.mockRejectedValue(new Error("Not Found"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.ok).toBe(false);
  });

  it("does not leak the cluster URL or api key in the error body", async () => {
    getCollection.mockRejectedValue(
      new Error("connect ECONNREFUSED https://secret-cluster.qdrant.io:6333 api-key=sk-abc"),
    );

    const res = await GET();
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain("secret-cluster");
    expect(body).not.toContain("api-key");
  });

  it("reports ok even when points_count is absent from the response", async () => {
    getCollection.mockResolvedValue({ status: "green" });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.points).toBeNull();
  });
});
