"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/* ── Tiny pixel-art provider icons (4×4 grid, crisp squares) ────────────── */

function GoogleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 4 4" style={{ shapeRendering: "crispEdges" }} aria-hidden>
      <rect x={0} y={0} width={2} height={2} fill="#EA4335" />
      <rect x={2} y={0} width={2} height={2} fill="#4285F4" />
      <rect x={0} y={2} width={2} height={2} fill="#FBBC05" />
      <rect x={2} y={2} width={2} height={2} fill="#34A853" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 4 4" style={{ shapeRendering: "crispEdges" }} aria-hidden>
      <rect x={0} y={0} width={1.9} height={1.9} fill="#F25022" />
      <rect x={2.1} y={0} width={1.9} height={1.9} fill="#7FBA00" />
      <rect x={0} y={2.1} width={1.9} height={1.9} fill="#00A4EF" />
      <rect x={2.1} y={2.1} width={1.9} height={1.9} fill="#FFB900" />
    </svg>
  );
}

const inputClass =
  "w-full font-plex text-[14px] text-[#f8f6f2] bg-[#12172a] border-2 border-[#2b3450] rounded-lg px-3.5 py-2.5 outline-none placeholder:text-[#5b6480] focus:border-[#FFD23F] transition-colors";

export function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submitEmail() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
      if (res.error) setError(res.error.message ?? "로그인에 실패했어요. 다시 시도해 주세요.");
      else onSuccess();
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "microsoft") {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signIn.social({ provider, callbackURL: "/assistant" });
      if (res.error) setError(res.error.message ?? "로그인에 실패했어요. 다시 시도해 주세요.");
      // On success, better-auth performs its own full-page OAuth redirect —
      // nothing further to do here.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-[rgba(10,14,25,0.72)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="로그인이 필요해요"
        className="font-plex relative w-full max-w-[380px] bg-[#1a2030] border-2 border-[#FFD23F] rounded-[14px] shadow-[0_10px_34px_rgba(10,14,25,0.6)] px-6 py-6"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close login dialog"
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
          <div className="font-pixel text-[12px] text-[#FFD23F] leading-relaxed">로그인이 필요해요</div>
          <div className="mt-2 font-plex text-[13px] text-[#b7bfd4] leading-relaxed">
            전문가들이 계속 도와드리려면 로그인해 주세요
          </div>
        </div>

        {/* OAuth */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => social("google")}
            className="flex items-center justify-center gap-2.5 font-pixel text-[9px] text-[#1a2030] bg-[#f8f6f2] hover:bg-white border-2 border-[#1a2030] rounded-lg px-4 py-2.5 cursor-pointer shadow-[0_3px_0_#0a0e19] active:translate-y-[2px] active:shadow-[0_1px_0_#0a0e19] transition-transform"
          >
            <GoogleIcon />
            GOOGLE로 계속하기
          </button>
          <button
            type="button"
            onClick={() => social("microsoft")}
            className="flex items-center justify-center gap-2.5 font-pixel text-[9px] text-[#f8f6f2] bg-[#232b42] hover:bg-[#2b3450] border-2 border-[#2b3450] rounded-lg px-4 py-2.5 cursor-pointer shadow-[0_3px_0_#0a0e19] active:translate-y-[2px] active:shadow-[0_1px_0_#0a0e19] transition-transform"
          >
            <MicrosoftIcon />
            NEU 학교 계정으로 로그인
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[#2b3450]" />
          <span className="font-pixel text-[6px] text-[#5b6480]">OR</span>
          <div className="h-px flex-1 bg-[#2b3450]" />
        </div>

        {/* Email form */}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            submitEmail();
          }}
          className="flex flex-col gap-2.5"
        >
          {mode === "signup" && (
            <input
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder="Name (optional)"
              className={inputClass}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="Email"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="Password"
            required
            className={inputClass}
          />

          {error && (
            <div className="font-plex text-[12.5px] text-[#ff8a8a] bg-[#2a1218] border border-[#CC0000] rounded-md px-3 py-2 leading-snug">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 font-pixel text-[10px] text-white bg-[#CC0000] hover:bg-[#e51b1b] disabled:opacity-50 disabled:hover:bg-[#CC0000] border-2 border-[#1a2030] rounded-lg px-4 py-3 cursor-pointer disabled:cursor-default shadow-[0_3px_0_#7a0000] enabled:active:translate-y-[2px] enabled:active:shadow-[0_1px_0_#7a0000] transition-transform"
          >
            {busy ? "잠시만요…" : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        {/* Mode toggle */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode((m) => (m === "login" ? "signup" : "login"));
            }}
            className="font-pixel text-[7px] text-[#FFD23F] hover:text-[#ffdf70] underline cursor-pointer"
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
