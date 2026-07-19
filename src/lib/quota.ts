// src/lib/quota.ts
export const PLAN_LIMITS = { free: 10, plus: 30, pro: 100 } as const;
export type Tier = keyof typeof PLAN_LIMITS;

/** UTC instant of today's midnight in America/New_York (handles DST). */
export function etDayStartUtc(now: Date = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const wallNowAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second);
  const offsetMs = wallNowAsUtc - now.getTime(); // ET-UTC offset at `now`
  const wallMidnightAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  return new Date(wallMidnightAsUtc - offsetMs);
}

/** Highest active paid plan wins; anything not "active" is ignored. */
export function resolveTier(subs: Array<{ plan: string; status: string }>): Tier {
  const active = new Set(subs.filter((s) => s.status === "active").map((s) => s.plan));
  if (active.has("pro")) return "pro";
  if (active.has("plus")) return "plus";
  return "free";
}
