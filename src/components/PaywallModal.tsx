"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// Shared shape with page.tsx's `usage` state (Task 8) — kept structurally
// compatible rather than imported so this component has no import-cycle risk
// back into page.tsx.
export interface UsageSnapshot {
  used: number;
  limit: number;
  tier: string;
}

interface Plan {
  id: "plus" | "pro";
  name: string;
  price: string;
  perDay: string;
  best?: boolean;
}

const PLANS: Plan[] = [
  { id: "plus", name: "HUSKY PLUS", price: "$9.99/mo", perDay: "30 questions a day" },
  { id: "pro", name: "HUSKY PRO", price: "$49.99/mo", perDay: "100 questions a day", best: true },
];

export function PaywallModal({
  open,
  onClose,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  usage: UsageSnapshot | null;
}) {
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleUpgrade(plan: Plan["id"]) {
    setError(null);
    try {
      await authClient.subscription.upgrade({
        plan,
        successUrl: "/assistant?upgraded=1",
        cancelUrl: "/assistant",
      });
    } catch (err) {
      console.error("failed to start checkout", err);
      setError("Couldn't start checkout. Try again in a moment.");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-[rgba(10,14,25,0.72)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Daily limit reached"
        className="font-plex relative w-full max-w-[420px] bg-[#1a2030] border-2 border-[#FFD23F] rounded-[14px] shadow-[0_10px_34px_rgba(10,14,25,0.6)] px-6 py-6"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close paywall dialog"
          className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#CC0000] hover:bg-[#e51b1b] border-2 border-[#7a0000] rounded-md cursor-pointer grid place-items-center"
        >
          <svg width={16} height={16} viewBox="0 0 7 7" style={{ shapeRendering: "crispEdges" }} aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={i} x={i} y={i} width={1} height={1} fill="#ffffff" />
            ))}
            {[0, 1, 2, 4, 5, 6].map((i) => (
              <rect key={`a${i}`} x={6 - i} y={i} width={1} height={1} fill="#ffffff" />
            ))}
          </svg>
        </button>

        {/* Header */}
        <div className="pr-8 mb-5">
          <div className="font-pixel text-[11px] text-[#FFD23F] leading-relaxed">
            THAT'S TODAY'S LIMIT ({usage ? usage.used : 0}/{usage ? usage.limit : 0})
          </div>
        </div>

        {/* Plan cards */}
        <div className="flex flex-col gap-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleUpgrade(plan.id)}
              className={`relative text-left rounded-lg border-2 px-4 py-3.5 cursor-pointer transition-colors ${
                plan.best
                  ? "border-[#FFD23F] bg-[#232b42] hover:bg-[#2b3450]"
                  : "border-[#2b3450] bg-[#12172a] hover:border-[#3d4a6b]"
              }`}
            >
              {plan.best && (
                <span className="absolute -top-2.5 right-4 font-pixel text-[6px] text-[#1a2030] bg-[#FFD23F] rounded px-2 py-1">
                  BEST
                </span>
              )}
              <div className="font-pixel text-[9px] text-[#f8f6f2]">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-pixel text-[11px] text-[#FFD23F]">{plan.price}</span>
              </div>
              <div className="mt-1.5 font-plex text-[13px] text-[#b7bfd4]">{plan.perDay}</div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 font-plex text-[12.5px] text-[#ff8a8a] bg-[#2a1218] border border-[#CC0000] rounded-md px-3 py-2 leading-snug">
            {error}
          </div>
        )}

        {/* Footnote */}
        <div className="mt-5 text-center font-plex text-[11.5px] text-[#5b6480]">
          Cancel anytime. Payments secured by Stripe.
        </div>
      </div>
    </div>
  );
}
