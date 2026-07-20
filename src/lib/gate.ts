// src/lib/gate.ts
import { createHmac, timingSafeEqual } from "crypto";

export const ANON_LIMIT = 2;
const NAME = "neu_anon";

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}

function sign(v: string): string {
  return createHmac("sha256", secret()).update(v).digest("base64url");
}

/** Parse the request Cookie header; invalid/absent/tampered → 0. */
export function readAnonCount(cookieHeader: string | null): number {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${NAME}=([^;]+)`));
  if (!match) return 0;
  const [count, sig] = match[1].split(".");
  if (!count || !sig) return 0;
  const expected = Buffer.from(sign(count));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 0;
  const n = parseInt(count, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Full Set-Cookie header value carrying the signed count. */
export function serializeAnonCookie(count: number): string {
  const v = String(count);
  return `${NAME}=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}
