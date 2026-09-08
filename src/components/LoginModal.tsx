"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/* ── Provider brand marks ───────────────────────────────────────────────────
   These are the only non-pixel artwork in the modal, on purpose: Google's and
   GitHub's marks may not be redrawn or restyled per their brand guidelines,
   and the smooth vectors against the blocky frame read as "external service"
   rather than decoration.                                                    */

function GoogleMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const inputClass =
  "w-full font-plex text-[14px] text-[#f8f6f2] bg-[#12172a] border-2 border-[#2b3450] rounded-lg px-3.5 py-2.5 outline-none placeholder:text-[#5b6480] focus:border-[#FFD23F] transition-colors";

const socialClass =
  "flex items-center justify-center gap-2.5 font-pixel text-[9px] rounded-lg px-4 py-2.5 cursor-pointer border-2 shadow-[0_3px_0_#0a0e19] active:translate-y-[2px] active:shadow-[0_1px_0_#0a0e19] transition-transform";

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

  const signingUp = mode === "signup";

  async function submitEmail() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = signingUp
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
      if (res.error)
        setError(
          res.error.message ??
            (signingUp
              ? "Couldn't create that account. Try a different email."
              : "Couldn't sign you in. Check your email and password."),
        );
      else onSuccess();
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "github") {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signIn.social({ provider, callbackURL: "/assistant" });
      if (res.error)
        setError(
          res.error.message ??
            `Couldn't reach ${provider === "google" ? "Google" : "GitHub"}. Try again.`,
        );
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
        aria-label={signingUp ? "Create account" : "Sign in to continue"}
        className="font-plex relative w-full max-w-[380px] bg-[#1a2030] border-2 border-[#FFD23F] rounded-[14px] shadow-[0_10px_34px_rgba(10,14,25,0.6)] px-6 py-6"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
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
          <div className="font-pixel text-[12px] text-[#FFD23F] leading-relaxed">
            {signingUp ? "CREATE ACCOUNT" : "SIGN IN TO CONTINUE"}
          </div>
          <div className="mt-2 font-plex text-[13px] text-[#b7bfd4] leading-relaxed">
            {signingUp
              ? "10 questions a day, and every chat saved to your history."
              : "You've used your free questions. Sign in to keep asking the experts."}
          </div>
        </div>

        {/* Email form */}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            submitEmail();
          }}
          className="flex flex-col gap-2.5"
        >
          {signingUp && (
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
            {busy ? (signingUp ? "CREATING…" : "SIGNING IN…") : signingUp ? "CREATE ACCOUNT" : "SIGN IN"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[#2b3450]" />
          <span className="font-pixel text-[6px] text-[#5b6480]">OR</span>
          <div className="h-px flex-1 bg-[#2b3450]" />
        </div>

        {/* OAuth */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => social("google")}
            className={`${socialClass} text-[#1a2030] bg-[#f8f6f2] hover:bg-white border-[#1a2030]`}
          >
            <GoogleMark />
            CONTINUE WITH GOOGLE
          </button>
          <button
            type="button"
            onClick={() => social("github")}
            className={`${socialClass} text-[#f8f6f2] bg-[#232b42] hover:bg-[#2b3450] border-[#2b3450]`}
          >
            <GitHubMark />
            CONTINUE WITH GITHUB
          </button>
        </div>

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
            {signingUp ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}
