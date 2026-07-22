import { describe, it, expect } from "vitest";
import { sortConversations } from "@/lib/sort-conversations";

it("orders pinned first, then most recent", () => {
  const out = sortConversations([
    { id: "old-pin", pinned: true, updatedAt: "2026-07-01T00:00:00Z" },
    { id: "new", pinned: false, updatedAt: "2026-07-18T00:00:00Z" },
    { id: "new-pin", pinned: true, updatedAt: "2026-07-10T00:00:00Z" },
    { id: "old", pinned: false, updatedAt: "2026-06-01T00:00:00Z" },
  ]);
  expect(out.map((c: { id: string }) => c.id)).toEqual(["new-pin", "old-pin", "new", "old"]);
});
