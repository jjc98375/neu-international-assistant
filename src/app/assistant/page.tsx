"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Press_Start_2P, IBM_Plex_Mono } from "next/font/google";
import { PixelQuad } from "@/components/PixelQuad";
import type { Category } from "@/lib/rag-categories";
import { AVAILABLE_CAMPUSES, CAMPUS_KEYS } from "@/lib/campuses";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex",
});

/* ── Custom pixel-themed dropdown (native <select> renders its popup in the
   OS's own light theme, which clashes badly with the dark pixel UI) ────── */

function CampusPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: { key: string; label: string }[] = [
    ...CAMPUS_KEYS.map((k) => ({ key: k, label: AVAILABLE_CAMPUSES[k].toUpperCase() })),
    { key: "all", label: "ALL CAMPUSES" },
  ];
  const currentLabel = options.find((o) => o.key === value)?.label ?? "ALL CAMPUSES";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 bg-[#12172a] border-2 rounded-lg cursor-pointer transition-colors ${
          open ? "border-[#FFD23F]" : "border-[#2b3450] hover:border-[#3d4a6b]"
        } ${compact ? "px-3 py-2" : "px-3.5 py-2"}`}
      >
        <span className="hidden sm:inline font-pixel text-[7px] text-[#8b93a5]">CAMPUS</span>
        <span className="font-pixel text-[7px] text-[#FFD23F] whitespace-nowrap">{currentLabel}</span>
        <span className={`font-pixel text-[7px] text-[#8b93a5] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-2 min-w-full w-max bg-[#12172a] border-2 border-[#FFD23F] rounded-lg py-1.5 shadow-[0_8px_24px_rgba(10,14,25,0.6)] z-50"
        >
          {options.map((o) => {
            const isSelected = o.key === value;
            return (
              <li key={o.key} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 font-pixel text-[7px] whitespace-nowrap cursor-pointer transition-colors ${
                    isSelected ? "text-[#FFD23F] bg-[#1a2030]" : "text-[#f8f6f2] hover:bg-[#1a2030] hover:text-[#FFD23F]"
                  }`}
                >
                  {isSelected ? "✓ " : "  "}
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Sprites: 10×10 pixel maps, rendered as SVG <symbol>s ──────────────── */

const SPRITES: Record<string, { colors: Record<string, string>; map: string[] }> = {
  billing: {
    colors: { V: "#3fa060", S: "#e8b98a", K: "#2a2320", W: "#f2f3f5", R: "#ffffff", L: "#3fa060" },
    map: [
      "..VVVVVV..", ".VVVVVVVV.", "..SSSSSS..", "..SKSSKS..", "..SSSSSS..",
      "...SSSS...", ".WWWWWW.RR", ".WWWWWW.RL", ".WWWWWW.RR", ".WWWWWW.RL",
    ],
  },
  professor: {
    colors: { H: "#cfd2d8", S: "#e8b98a", Q: "#2a2320", J: "#7a5a3a", W: "#f2f3f5" },
    map: [
      "..HHHHHH..", ".HHHHHHHH.", ".HSSSSSSH.", ".QQQSSQQQ.", "..SSSSSS..",
      "...SSSS...", ".JJWWWWJJ.", ".JJWWWWJJ.", ".JJJWWJJJ.", ".JJJJJJJJ.",
    ],
  },
  business: {
    colors: { K: "#2a2320", S: "#e8b98a", B: "#2a3a55", T: "#CC0000", W: "#f2f3f5" },
    map: [
      "..KKKKKK..", ".KKKKKKKK.", ".KSSSSSSK.", "..SKSSKS..", "..SSSSSS..",
      "...SSSS...", ".BBWWWWBB.", ".BBWTTWBB.", ".BBWTTWBB.", ".BBBWWBBB.",
    ],
  },
  scholar: {
    colors: { M: "#16181d", D: "#FFD23F", S: "#e8b98a", K: "#2a2320", G: "#232838" },
    map: [
      ".MMMMMMMM.", "MMMMMMMMMM", "...MMMM.D.", "..SSSSSS.D", "..SKSSKS..",
      "..SSSSSS..", ".GGDDDDGG.", ".GGDGGDGG.", ".GGDGGDGG.", ".GGGGGGGG.",
    ],
  },
  visa: {
    colors: { C: "#22304d", D: "#FFD23F", S: "#e8b98a", K: "#2a2320", U: "#2a3a55", P: "#CC0000" },
    map: [
      ".CCCCCCCC.", "CCCCDDCCCC", ".CCCCCCCC.", "..SSSSSS..", "..SKSSKS..",
      "..SSSSSS..", ".UUUUUU.PP", ".UUUUUU.PP", ".UUUUUU.PD", ".UUUUUU.PP",
    ],
  },
};

function SpriteDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      {Object.entries(SPRITES).map(([id, s]) => (
        <symbol key={id} id={`sp-${id}`} viewBox="0 0 10 10">
          {s.map.flatMap((row, y) =>
            [...row].map((ch, x) => {
              const fill = s.colors[ch];
              return fill ? (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
              ) : null;
            }),
          )}
        </symbol>
      ))}
    </svg>
  );
}

/* ── Experts: sprite + quad position + RAG category ────────────────────── */

interface Expert {
  id: string;
  /** key into SPRITES */ sprite: string;
  label: string;
  title: string;
  category: Category | "auto";
  /** left position, vw */ x: number;
  /** bottom position, vh */ b: number;
  /** sprite size, px */ s: number;
  greeting: string;
}

// All five stand in one line on the front lawn.
const EXPERTS: Expert[] = [
  {
    id: "course", sprite: "professor", label: "Course Registration", title: "REGISTRATION EXPERT", category: "course", x: 14, b: 11, s: 64,
    greeting: "Full-time credit requirements, enrollment windows, add/drop rules — ask me before you touch your schedule.",
  },
  {
    id: "coop", sprite: "business", label: "Co-op", title: "CO-OP EXPERT", category: "employment", x: 32, b: 11, s: 64,
    greeting: "Six-month co-ops, CPT/OPT authorization, on-campus jobs — ask me before you accept any offer.",
  },
  {
    id: "visa", sprite: "visa", label: "Visa", title: "VISA EXPERT", category: "visa", x: 50, b: 11, s: 64,
    greeting: "F-1 status, SEVIS records, travel signatures, visa stamps — ask before you book anything.",
  },
  {
    id: "billing", sprite: "billing", label: "Billing", title: "BILLING EXPERT", category: "billing", x: 68, b: 11, s: 64,
    greeting: "Account holds, payment plans, health-insurance waivers — ask me about anything on your student bill.",
  },
  {
    id: "scholarship", sprite: "scholar", label: "Scholarship", title: "SCHOLARSHIP EXPERT", category: "scholarships", x: 86, b: 11, s: 64,
    greeting: "Merit awards, grants, and outside scholarships — ask me what's available and when to apply.",
  },
];

/* ── Chat state ────────────────────────────────────────────────────────── */

interface Msg {
  from: "user" | "bot";
  text: string;
  categoryName?: string;
  viaWeb?: boolean;
  sources?: { filename: string; preview: string }[];
  error?: boolean;
}

function initialMsgs(): Record<string, Msg[]> {
  return Object.fromEntries(EXPERTS.map((e) => [e.id, [{ from: "bot", text: e.greeting }]]));
}

export default function AssistantPage() {
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(initialMsgs);
  const [input, setInput] = useState("");
  const [campus, setCampus] = useState("boston");
  const [busyId, setBusyId] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeExpert = EXPERTS.find((e) => e.id === active) ?? null;

  // Deep link: /assistant?expert=visa opens that expert's chat on load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("expert");
    if (id && EXPERTS.some((e) => e.id === id)) setActive(id);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active, msgs, busyId]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  async function send() {
    const question = input.trim();
    const expert = activeExpert;
    if (!question || !expert || busyId) return;
    const id = expert.id;

    setMsgs((m) => ({ ...m, [id]: [...m[id], { from: "user", text: question }] }));
    setInput("");
    setBusyId(id);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category: expert.category, campus }),
      });
      const data = await res.json();
      const reply: Msg = res.ok
        ? {
            from: "bot",
            text: data.answer,
            categoryName: data.categoryName,
            viaWeb: data.viaWeb,
            sources: data.sources,
          }
        : {
            from: "bot",
            text: `Something went wrong on my desk (${data.error ?? `HTTP ${res.status}`}). Ask again in a moment.`,
            error: true,
          };
      setMsgs((m) => ({ ...m, [id]: [...m[id], reply] }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMsgs((m) => ({
        ...m,
        [id]: [...m[id], { from: "bot", text: `I couldn't reach the records office (${detail}). Check your connection and ask again.`, error: true }],
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={`${pixelFont.variable} ${plexMono.variable}`}>
      {/* Animated pixel-art quad background */}
      <div className="fixed inset-0">
        <PixelQuad />
      </div>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,25,0.3) 0%, rgba(10,14,25,0) 20%, rgba(10,14,25,0) 82%, rgba(10,14,25,0.12) 100%)",
        }}
      />

      <SpriteDefs />

      {/* Click-outside catcher (below characters, above background) */}
      {active && (
        <div
          className="fixed inset-0 z-[5] bg-[rgba(10,14,25,0.28)]"
          onClick={() => setActive(null)}
        />
      )}

      {/* Status + hint chips, below the site navbar */}
      <div className="fixed top-20 inset-x-4 z-40 flex items-start gap-3 pointer-events-none">
        <div className="hidden sm:flex items-center bg-[rgba(16,21,36,0.9)] border-2 border-[#2b3450] rounded-[10px] px-3.5 py-2.5">
          <span className="font-pixel text-[7px] text-[#8b93a5]">
            5 EXPERTS ON DUTY <span className="quad-blink text-[#FFD23F]">▮</span>
          </span>
        </div>
        <div className="pointer-events-auto">
          <CampusPicker value={campus} onChange={setCampus} />
        </div>
        {!active && (
          <div className="ml-auto bg-[rgba(16,21,36,0.9)] border-2 border-[#FFD23F] rounded-full px-3.5 py-2.5">
            <span className="font-pixel text-[7px] text-[#FFD23F]">▼ CLICK AN EXPERT ON THE QUAD</span>
          </div>
        )}
      </div>

      {/* Characters on the quad */}
      <div className="fixed inset-0">
        {EXPERTS.map((e, i) => {
          const isActive = e.id === active;
          const isHover = hovered === e.id;
          return (
            <div
              key={e.id}
              className="absolute flex flex-col items-center gap-1 -translate-x-1/2"
              style={{ left: `${e.x}vw`, bottom: `${e.b}vh`, zIndex: 10 + Math.round(40 - e.b) }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[rgba(10,14,25,0.4)] blur-[3px]"
                style={{ bottom: 18, width: e.s * 0.8, height: 10 }}
              />
              <button
                onClick={() => setActive(isActive ? null : e.id)}
                onMouseEnter={() => setHovered(e.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={`Chat with the ${e.label} expert`}
                className="quad-bob relative block cursor-pointer bg-transparent border-none p-0"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                {isActive && (
                  <div className="quad-bounce absolute -top-5 left-1/2 -translate-x-1/2 font-pixel text-[10px] text-[#FFD23F] [text-shadow:1px_1px_0_#1a2030]">
                    ▼
                  </div>
                )}
                <svg
                  width={e.s}
                  height={e.s}
                  viewBox="0 0 10 10"
                  className="block transition-transform duration-150"
                  style={{
                    shapeRendering: "crispEdges",
                    transform: isHover && !isActive ? "scale(1.12)" : "scale(1)",
                    filter: isActive
                      ? "drop-shadow(0 0 6px rgba(255,210,63,0.95)) drop-shadow(2px 3px 0 rgba(10,14,25,0.5))"
                      : "drop-shadow(2px 3px 0 rgba(10,14,25,0.5))",
                  }}
                >
                  <use href={`#sp-${e.sprite}`} />
                </svg>
              </button>
              <div
                className={`font-pixel text-[6px] whitespace-nowrap rounded px-[7px] py-[5px] pointer-events-none bg-[rgba(16,21,36,0.88)] border ${
                  isActive ? "text-[#FFD23F] border-[#FFD23F]" : "text-[#f8f6f2] border-[#2b3450]"
                }`}
              >
                {e.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat popup */}
      {activeExpert && (
        <div
          role="dialog"
          aria-label={activeExpert.title}
          className="quad-pullup font-plex fixed z-[200] inset-x-4 bottom-0 h-[calc(100vh-88px)] flex flex-col overflow-hidden bg-[rgba(248,246,242,0.97)] border-2 border-b-0 border-[#1a2030] rounded-t-[14px] shadow-[0_-10px_34px_rgba(10,14,25,0.5)]"
        >
          {/* Header */}
          <div className="flex items-center gap-3.5 px-5 py-3.5 bg-[#1a2030] border-b-2 border-[#2b3450] flex-none">
            <div className="w-[54px] h-[54px] flex-none bg-[#232b42] border-2 border-[#FFD23F] rounded-[10px] grid place-items-center">
              <svg width={40} height={40} viewBox="0 0 10 10" className="block" style={{ shapeRendering: "crispEdges" }}>
                <use href={`#sp-${activeExpert.sprite}`} />
              </svg>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="font-pixel text-[10px] sm:text-xs text-[#f8f6f2] truncate">
                {activeExpert.title}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-[7px] h-[7px] bg-[#3fd06f] border border-[#0f3a20] inline-block" />
                <span className="font-pixel text-[6px] text-[#8b93a5]">ONLINE · ON THE QUAD</span>
              </div>
            </div>
            <div className="ml-auto">
              <CampusPicker value={campus} onChange={setCampus} compact />
            </div>
            <button
              onClick={() => setActive(null)}
              aria-label="Close chat"
              className="flex-none w-9 h-9 bg-[#CC0000] hover:bg-[#e51b1b] border-2 border-[#7a0000] rounded-md cursor-pointer grid place-items-center"
            >
              {/* pixel-art X */}
              <svg width={18} height={18} viewBox="0 0 7 7" style={{ shapeRendering: "crispEdges" }} aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <rect key={i} x={i} y={i} width={1} height={1} fill="#ffffff" />
                ))}
                {[0, 1, 2, 4, 5, 6].map((i) => (
                  <rect key={`a${i}`} x={6 - i} y={i} width={1} height={1} fill="#ffffff" />
                ))}
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={chatRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 py-6 flex flex-col gap-4"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(26,32,48,0.03) 0px, rgba(26,32,48,0.03) 1px, transparent 1px, transparent 22px)",
            }}
          >
            {msgs[activeExpert.id].map((m, i) =>
              m.from === "bot" ? (
                <div key={i} className="flex gap-2.5 items-start max-w-[min(680px,88%)] sm:max-w-[min(680px,78%)]">
                  <div className="w-[26px] h-[26px] flex-none bg-[#1a2030] border-2 border-[#FFD23F] rounded-md grid place-items-center mt-0.5">
                    <svg width={20} height={20} viewBox="0 0 10 10" className="block" style={{ shapeRendering: "crispEdges" }}>
                      <use href={`#sp-${activeExpert.sprite}`} />
                    </svg>
                  </div>
                  <div
                    className={`rounded-[10px_10px_10px_0] px-4 py-3 text-[14.5px] leading-relaxed shadow-[2px_3px_0_rgba(26,32,48,0.18)] border-2 ${
                      m.error
                        ? "bg-[#fff2f0] border-[#CC0000] text-[#7a0000]"
                        : "bg-[rgba(255,255,255,0.95)] border-[#1a2030] text-[#1a2030]"
                    }`}
                  >
                    {m.categoryName && (
                      <div className="font-pixel text-[6px] text-[#1a2030]/55 mb-2">
                        {m.viaWeb ? m.categoryName.toUpperCase() : `FILED UNDER: ${m.categoryName.toUpperCase()}`}
                      </div>
                    )}
                    <div className="space-y-2 [&_p]:my-0">
                      <ReactMarkdown
                        components={{
                          strong: (props) => (
                            <strong className="font-bold text-[#CC0000]" {...props} />
                          ),
                          ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                          ol: (props) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                          a: (props) => (
                            <a
                              className="text-[#CC0000] underline hover:text-[#7a0000] break-all"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                          code: (props) => (
                            <code className="bg-[#1a2030]/8 rounded px-1 font-plex text-[13px]" {...props} />
                          ),
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                    {m.sources && m.sources.length > 0 && (
                      <details className="mt-3 border-t border-[#1a2030]/15 pt-2">
                        <summary className="cursor-pointer select-none font-pixel text-[7px] text-[#1a2030]/60">
                          SOURCES ({m.sources.length})
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {m.sources.map((s) => (
                            <li key={s.filename} className="text-[11px] leading-snug">
                              <span className="font-semibold">{s.filename}</span>
                              {/^https?:\/\//.test(s.preview) ? (
                                <a
                                  href={s.preview}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[#CC0000] hover:text-[#7a0000] underline truncate"
                                >
                                  {s.preview}
                                </a>
                              ) : (
                                <span className="block text-[#1a2030]/50 truncate">{s.preview}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end ml-auto max-w-[min(600px,82%)] sm:max-w-[min(600px,72%)]">
                  <div className="bg-[#CC0000] border-2 border-[#7a0000] rounded-[10px_10px_0_10px] px-4 py-3 text-[14.5px] leading-relaxed text-white shadow-[2px_3px_0_rgba(26,32,48,0.18)]">
                    {m.text}
                  </div>
                </div>
              ),
            )}
            {busyId === activeExpert.id && (
              <div className="flex gap-2.5 items-start">
                <div className="w-[26px] h-[26px] flex-none bg-[#1a2030] border-2 border-[#FFD23F] rounded-md grid place-items-center mt-0.5">
                  <svg width={20} height={20} viewBox="0 0 10 10" className="block" style={{ shapeRendering: "crispEdges" }}>
                    <use href={`#sp-${activeExpert.sprite}`} />
                  </svg>
                </div>
                <div className="bg-[rgba(255,255,255,0.95)] border-2 border-[#1a2030] rounded-[10px_10px_10px_0] px-3 py-2.5 flex gap-1.5">
                  <span className="quad-dot w-1.5 h-1.5 bg-[#1a2030] inline-block" />
                  <span className="quad-dot w-1.5 h-1.5 bg-[#1a2030] inline-block [animation-delay:.2s]" />
                  <span className="quad-dot w-1.5 h-1.5 bg-[#1a2030] inline-block [animation-delay:.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-3 px-4 sm:px-5 py-4 bg-[rgba(239,236,229,0.9)] border-t-2 border-[#1a2030] flex-none">
            <input
              ref={inputRef}
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") send();
              }}
              placeholder={`Ask the ${activeExpert.label.toLowerCase()} expert…`}
              className="flex-1 min-w-0 font-plex text-[15px] text-[#1a2030] bg-white border-2 border-[#1a2030] rounded-lg px-4 py-3 outline-none focus:border-[#CC0000] focus:shadow-[0_0_0_3px_rgba(204,0,0,0.15)]"
            />
            <button
              onClick={send}
              disabled={busyId === activeExpert.id || !input.trim()}
              className="flex-none font-pixel text-[10px] text-white bg-[#CC0000] hover:bg-[#e51b1b] disabled:opacity-50 disabled:hover:bg-[#CC0000] border-2 border-[#1a2030] rounded-lg px-4 sm:px-6 cursor-pointer disabled:cursor-default shadow-[0_3px_0_#7a0000] enabled:active:translate-y-[2px] enabled:active:shadow-[0_1px_0_#7a0000]"
            >
              SEND ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
