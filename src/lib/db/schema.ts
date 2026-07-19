// src/lib/db/schema.ts
import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const EXPERT_IDS = ["course", "coop", "visa", "billing", "scholarship"] as const;
export type ExpertId = (typeof EXPERT_IDS)[number];

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(), // crypto.randomUUID()
    userId: text("user_id").notNull(),
    expertId: text("expert_id").notNull(),
    campus: text("campus"),
    title: text("title").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(), // denormalized for quota counting
    role: text("role").notNull(), // "user" | "bot"
    content: text("content").notNull(),
    categoryName: text("category_name"),
    viaWeb: boolean("via_web").notNull().default(false),
    sources: jsonb("sources"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_quota_idx").on(t.userId, t.role, t.createdAt),
          index("messages_convo_idx").on(t.conversationId, t.createdAt)],
);

export * from "./auth-schema"; // generated in Task 4 (create empty file now)
