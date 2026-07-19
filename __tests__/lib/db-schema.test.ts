import { describe, it, expect } from "vitest";
import { conversations, messages, EXPERT_IDS } from "@/lib/db/schema";
import { getTableName } from "drizzle-orm";

describe("db schema", () => {
  it("defines conversations and messages tables", () => {
    expect(getTableName(conversations)).toBe("conversations");
    expect(getTableName(messages)).toBe("messages");
  });
  it("exposes the five expert ids", () => {
    expect(EXPERT_IDS).toEqual(["course", "coop", "visa", "billing", "scholarship"]);
  });
});
