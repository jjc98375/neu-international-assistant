// __tests__/lib/rag-clients.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  it("getQdrant throws a clear error when QDRANT_API_KEY is missing", async () => {
    process.env.QDRANT_URL = "http://localhost:6333";
    delete process.env.QDRANT_API_KEY;
    const { getQdrant } = await import("@/lib/rag-clients");
    expect(() => getQdrant()).toThrow("Missing required env var: QDRANT_API_KEY");
  });

  it("COLLECTION defaults to northeastern_docs", async () => {
    delete process.env.QDRANT_COLLECTION;
    const { COLLECTION } = await import("@/lib/rag-clients");
    expect(COLLECTION).toBe("northeastern_docs");
  });
});
