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
