// src/lib/quota.ts
export const PLAN_LIMITS = { free: 10, plus: 30, pro: 100 } as const;
export type Tier = keyof typeof PLAN_LIMITS;

/** The `usage` object every /api/assistant response carries. Anonymous
 *  callers report tier "anon", which is outside PLAN_LIMITS, so the tier is
 *  widened here rather than reusing Tier. */
export interface UsageSnapshot {
  used: number;
  limit: number;
  tier: Tier | "anon";
}

type EtParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function etParts(at: Date): EtParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +parts.hour % 24, minute: +parts.minute, second: +parts.second,
  };
}

/** ET-UTC offset (ms) in effect at the given instant. */
function etOffsetAt(utcMs: number): number {
  const p = etParts(new Date(utcMs));
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - utcMs;
}

/**
 * UTC instant of today's midnight in America/New_York. DST-correct: the
 * offset is resolved at the midnight instant itself (two-step convergence),
 * not at `now` — so every call within one ET calendar day agrees.
 */
export function etDayStartUtc(now: Date = new Date()): Date {
  const today = etParts(now);
  const wallMidnight = Date.UTC(today.year, today.month - 1, today.day);
  let guess = wallMidnight - etOffsetAt(wallMidnight);
  guess = wallMidnight - etOffsetAt(guess);
  return new Date(guess);
}

/** Highest active paid plan wins; anything not "active" is ignored. */
export function resolveTier(subs: Array<{ plan: string; status: string }>): Tier {
  const active = new Set(subs.filter((s) => s.status === "active").map((s) => s.plan));
  if (active.has("pro")) return "pro";
  if (active.has("plus")) return "plus";
  return "free";
}
