// src/lib/rag-categories.ts
/** Category keys + labels — MUST match CATEGORIES in ingestion/ingest.py. */
export const AVAILABLE_CATEGORIES = {
  arrival: "Arrival",
  billing: "Billing",
  course: "Course Registration",
  employment: "Employment",
  forms: "forms",
  scholarships: "Scholarships",
  tuition: "Tuition&Fees",
  visa: "Visa",
} as const;

export type Category = keyof typeof AVAILABLE_CATEGORIES;

export const CATEGORY_KEYS = Object.keys(AVAILABLE_CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
  return Object.prototype.hasOwnProperty.call(AVAILABLE_CATEGORIES, value);
}
