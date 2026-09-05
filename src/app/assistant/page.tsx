"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Press_Start_2P, IBM_Plex_Mono } from "next/font/google";
import { PixelQuad } from "@/components/PixelQuad";
import { LoginModal } from "@/components/LoginModal";
import { PaywallModal } from "@/components/PaywallModal";
import { ChatDrawer, type DrawerConversation } from "@/components/ChatDrawer";
import type { Category } from "@/lib/rag-categories";
import { AVAILABLE_CAMPUSES, CAMPUS_KEYS } from "@/lib/campuses";
import { authClient } from "@/lib/auth-client";
import { sortConversations } from "@/lib/sort-conversations";

// sessionStorage key: carries {expertId, question} across a full-page OAuth
// redirect so the gated question can still be auto-resent on return.
const PENDING_ASK_KEY = "neu_pending_ask";

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

// Shapes returned by the conversation-history endpoints (Task 6/9's API
// surface) — kept minimal/local to this file since nothing else consumes them.
interface ConversationSummary {
  id: string;
  expertId: string;
  campus?: string | null;
  title: string;
  pinned: boolean;
  updatedAt: string;
}

interface StoredMessage {
  role: string;
  content: string;
  categoryName?: string | null;
  viaWeb?: boolean | null;
  sources?: unknown;
  createdAt?: string;
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
  const [loginOpen, setLoginOpen] = useState(false);
  // Opened when send() hits a 429 quota_exceeded response (Task 10).
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Small toast-style chip shown briefly after a Stripe checkout redirects
  // back with ?upgraded=1 — cleared automatically after a few seconds.
  const [upgradedToast, setUpgradedToast] = useState(false);
  // Active conversation room per expert (undefined = no room yet / anonymous).
  const [conversationIds, setConversationIds] = useState<Record<string, string | undefined>>({});
  // Most recent quota snapshot from /api/assistant — consumed by Task 10's usage UI.
  const [usage, setUsage] = useState<{ used: number; limit: number; tier: string } | null>(null);
  // Full conversation-history list (Task 9's drawer) — distinct from
  // conversationIds above, which only tracks each expert's single most-recent
  // room for auto-resume. Fetched on login, refetched after pin/delete.
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingQuestion = useRef<string | null>(null);
  const pendingExpertId = useRef<string | null>(null);
  const imported = useRef(false);
  const prevSession = useRef<unknown>(null);
  // Tracks which experts' room messages have already been fetched from the
  // server this page-life, so opening the same expert twice doesn't refetch.
  const loadedMessages = useRef<Set<string>>(new Set());
  // Per-expert generation counter, bumped whenever that expert's `msgs`
  // array is reset (an optimistic send, or "+ NEW"). loadConversationMessages
  // captures the epoch at fetch-start and, on resolve, only applies its
  // full-array overwrite if the epoch is still the same — otherwise a new
  // send (or a reset) happened *during* the load's flight and the stale
  // historical snapshot must not clobber it.
  const msgsEpoch = useRef<Record<string, number>>({});
  // Live mirror of `busyId` (a plain ref, not state, so it's readable from
  // inside an already-suspended async function without a stale closure).
  // Covers the complementary race the epoch check above can't see: a send()
  // that started *before* the historical load and is still unresolved when
  // the load resolves. In that case the epoch was already bumped before the
  // load's fetch even started, so "unchanged since fetch-start" alone won't
  // catch it — checking "is this expert's send still in flight right now"
  // does.
  const busyIdRef = useRef<string | null>(null);

  const { data: session } = authClient.useSession();

  const activeExpert = EXPERTS.find((e) => e.id === active) ?? null;

  // Deep link: /assistant?expert=visa opens that expert's chat on load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("expert");
    if (id && EXPERTS.some((e) => e.id === id)) setActive(id);
  }, []);

  // Stripe checkout redirects back to /assistant?upgraded=1 on success (the
  // successUrl PaywallModal passes to subscription.upgrade). Refetch a probe
  // to refresh session-derived UI, show a brief "activated" toast chip, and
  // drop the query param so a refresh doesn't re-trigger this.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") !== "1") return;
    setPaywallOpen(false);
    setUpgradedToast(true);
    void loadConversationList();
    params.delete("upgraded");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
    const timer = setTimeout(() => setUpgradedToast(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Rehydrate a gated question across a full-page OAuth redirect: the ref
  // above doesn't survive navigation, so we mirror it into sessionStorage
  // when the gate fires and read it back here on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_ASK_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { expertId?: string; question?: string };
      if (saved.expertId && saved.question && EXPERTS.some((e) => e.id === saved.expertId)) {
        pendingQuestion.current = saved.question;
        pendingExpertId.current = saved.expertId;
        setActive(saved.expertId);
        setInput(saved.question);
      }
    } catch {
      /* sessionStorage unavailable or corrupt payload — ignore, nothing to resume */
    }
  }, []);

  // Auto-retry a gated question once the session goes from logged-out to
  // logged-in (email login/signup calls this directly via onSuccess too;
  // retryPending() no-ops the second time since it clears the ref first).
  // This same null->truthy transition also covers a plain page refresh while
  // already logged in (the session hook starts null until it resolves), so
  // it doubles as the hook point for resuming each expert's most recent room.
  useEffect(() => {
    if (!prevSession.current && session) {
      retryPending();
      void loadConversationList();
    }
    prevSession.current = session;
  }, [session]);

  // Lazily fetch a room's messages the first time its expert is opened (not
  // on every click): runs whenever the active expert or its known
  // conversationId changes, but the loadedMessages guard makes the actual
  // fetch fire at most once per expertId per page-life.
  useEffect(() => {
    if (!active) return;
    const convoId = conversationIds[active];
    if (!convoId || loadedMessages.current.has(active)) return;
    loadedMessages.current.add(active);
    void loadConversationMessages(active, convoId);
  }, [active, conversationIds]);

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

  // `overrideQuestion`/`overrideExpertId` let the login-retry paths resend
  // the gated question without depending on `input`/`active` having already
  // re-rendered (they're called synchronously, so those closures may still
  // hold stale/empty values at call time).
  async function send(overrideQuestion?: string, overrideExpertId?: string) {
    const question = (overrideQuestion ?? input).trim();
    const expert = overrideExpertId ? EXPERTS.find((e) => e.id === overrideExpertId) ?? activeExpert : activeExpert;
    if (!question || !expert || busyId) return;
    const id = expert.id;

    setMsgs((m) => ({ ...m, [id]: [...m[id], { from: "user", text: question }] }));
    msgsEpoch.current[id] = (msgsEpoch.current[id] ?? 0) + 1;
    setInput("");
    setBusyId(id);
    busyIdRef.current = id;

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          category: expert.category,
          campus,
          conversationId: conversationIds[id],
          expertId: id,
        }),
      });
      const data = await res.json();
      // The server includes a `usage` snapshot on both success and 429
      // (quota_exceeded) responses — read it unconditionally so the UI
      // reflects the latest count even on a rejected request.
      if (data?.usage) setUsage(data.usage);

      if (res.status === 401 && data?.gate) {
        // Server says an anonymous quota is exhausted: drop the optimistic
        // user bubble we just added (it re-appears via retryPending() once
        // login succeeds) and open the login modal instead of showing an
        // error reply.
        pendingQuestion.current = question;
        pendingExpertId.current = id;
        try {
          sessionStorage.setItem(PENDING_ASK_KEY, JSON.stringify({ expertId: id, question }));
        } catch {
          /* sessionStorage unavailable — the in-memory ref still covers same-tab retry */
        }
        setMsgs((m) => ({ ...m, [id]: m[id].slice(0, -1) }));
        setLoginOpen(true);
      } else if (res.status === 429) {
        // Quota exceeded for a logged-in user's tier: no bot reply/error
        // bubble — the paywall modal explains the cap and offers an upgrade.
        // The user's question bubble is left as-is (unlike the anonymous 401
        // gate above, there's no pending-question auto-retry once they
        // upgrade — successUrl just redirects back to /assistant?upgraded=1).
        setPaywallOpen(true);
      } else {
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
        msgsEpoch.current[id] = (msgsEpoch.current[id] ?? 0) + 1;
        if (res.ok) {
          if (data.conversationId) {
            setConversationIds((m) => ({ ...m, [id]: data.conversationId }));
            // This expert's room now definitely reflects the freshest server
            // state (we just appended to it), so mark it "loaded" — otherwise
            // the lazy-load effect above would see conversationIds[id] flip
            // from undefined to a real id and immediately refetch, redundantly
            // overwriting the message we just rendered optimistically.
            loadedMessages.current.add(id);
          }
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMsgs((m) => ({
        ...m,
        [id]: [...m[id], { from: "bot", text: `I couldn't reach the records office (${detail}). Check your connection and ask again.`, error: true }],
      }));
      msgsEpoch.current[id] = (msgsEpoch.current[id] ?? 0) + 1;
    } finally {
      setBusyId(null);
      if (busyIdRef.current === id) busyIdRef.current = null;
    }
  }

  // Shared by LoginModal's onSuccess (email login/signup, same tab, no
  // reload) and the session-transition effect (OAuth redirect-back). The
  // ref is cleared first so whichever trigger fires second is a no-op —
  // login success can plausibly fire both in quick succession.
  function retryPending() {
    const question = pendingQuestion.current;
    if (!question) return;
    const expertId = pendingExpertId.current ?? active ?? undefined;
    pendingQuestion.current = null;
    pendingExpertId.current = null;
    try {
      sessionStorage.removeItem(PENDING_ASK_KEY);
    } catch {
      /* ignore */
    }
    setLoginOpen(false);
    if (expertId && expertId !== active) setActive(expertId);
    setInput(question);
    send(question, expertId);
  }

  // Fetches this user's conversation rooms and, for each expert, remembers
  // the single most recent one (by updatedAt, independent of pinned — pin
  // ordering is a display concern for Task 9's drawer, not for which room
  // auto-resumes). Never clobbers a conversationId already known locally
  // (e.g. one just created by a send() that raced this same fetch).
  async function loadConversationList() {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      const list: ConversationSummary[] = data.conversations ?? [];
      setConversations(list);
      const mostRecent: Record<string, ConversationSummary> = {};
      for (const c of list) {
        const prev = mostRecent[c.expertId];
        if (!prev || new Date(c.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
          mostRecent[c.expertId] = c;
        }
      }
      setConversationIds((m) => {
        const next = { ...m };
        for (const [expertId, convo] of Object.entries(mostRecent)) {
          if (!next[expertId]) next[expertId] = convo.id;
        }
        return next;
      });
    } catch (err) {
      console.error("failed to load conversation list", err); // best-effort only
    }
  }

  // Loads a room's messages and replaces the expert's visible thread with
  // [greeting, ...serverMessages]. Called by the lazy-load effect and by
  // openConversation() below.
  async function loadConversationMessages(expertId: string, conversationId: string) {
    // Snapshot this expert's generation before the request goes out. If a
    // send() (or "+ NEW") bumps it before this resolves, the thread has
    // moved on and this historical snapshot is stale — applying it now
    // would clobber newer, in-flight local state.
    const epochAtStart = msgsEpoch.current[expertId] ?? 0;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const stored: StoredMessage[] = data.messages ?? [];
      const expert = EXPERTS.find((e) => e.id === expertId);
      const greeting: Msg = { from: "bot", text: expert?.greeting ?? "" };
      const loaded: Msg[] = stored.map((m) => ({
        from: m.role === "user" ? "user" : "bot",
        text: m.content,
        categoryName: m.categoryName ?? undefined,
        viaWeb: m.viaWeb ?? undefined,
        sources: (m.sources as Msg["sources"]) ?? undefined,
      }));
      // Bail if either: (a) a send/reset bumped the epoch during our flight
      // (a new send that started and possibly finished while we were in the
      // air), or (b) a send for this expert that started *before* us is
      // still unresolved right now (its epoch bump predates our own start,
      // so (a) can't see it — busyIdRef, read live, can).
      if ((msgsEpoch.current[expertId] ?? 0) !== epochAtStart || busyIdRef.current === expertId) return;
      setMsgs((prev) => ({ ...prev, [expertId]: [greeting, ...loaded] }));
    } catch (err) {
      console.error("failed to load conversation messages", err); // best-effort only
    }
  }

  // Called by Task 9's history drawer when the user picks a past room:
  // switches the active expert to it, points that expert at the chosen
  // conversation, and (by clearing the loaded-guard first) lets the lazy-load
  // effect above fetch and render its messages, then opens the popup.
  function openConversation(convo: { id: string; expertId: string }) {
    loadedMessages.current.delete(convo.expertId);
    setConversationIds((m) => ({ ...m, [convo.expertId]: convo.id }));
    setActive(convo.expertId);
  }

  // Task 9's drawer row click: resume that room and tuck the drawer away so
  // the chat popup it opens isn't left hidden behind it.
  function handleOpenConversation(convo: DrawerConversation) {
    openConversation(convo);
    setDrawerOpen(false);
  }

  // Optimistic pin/unpin: flips the row immediately (the drawer's whole
  // point is instant-feeling reordering), then reconciles with the server.
  // On failure, a stale optimistic flip left in `conversations` would
  // silently diverge from the DB, so refetch the authoritative list instead
  // of guessing how to roll back.
  async function handlePinConversation(id: string, pinned: boolean) {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, pinned } : c)));
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("failed to update pin", err);
      void loadConversationList();
    }
  }

  // Optimistic delete: removes the row immediately, then confirms with the
  // server. A failure (network error or a 404 on a room already gone/not
  // owned) refetches the real list rather than leaving the UI showing a row
  // that still exists server-side (or hiding one that's already gone).
  async function handleDeleteConversation(id: string) {
    setConversations((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Forget this room if it was any expert's "most recent" pointer, so a
      // future send() doesn't try to continue a conversation that no longer
      // exists server-side.
      setConversationIds((m) => {
        const next = { ...m };
        for (const [expertId, cid] of Object.entries(next)) {
          if (cid === id) delete next[expertId];
        }
        return next;
      });
    } catch (err) {
      console.error("failed to delete conversation", err);
      void loadConversationList();
    }
  }

  // Opens the Stripe Billing Portal (better-auth's stripeClient plugin
  // exposes it as subscription.billingPortal — the endpoint's response sets
  // {redirect: true, url}, which better-auth's client redirect plugin acts
  // on automatically, so there's nothing further to do here on success).
  function handleManagePlan() {
    authClient.subscription.billingPortal({ returnUrl: "/assistant" }).catch((err: unknown) => {
      console.error("failed to open billing portal", err);
    });
  }

  function handleLogout() {
    setDrawerOpen(false);
    authClient.signOut().catch((err: unknown) => console.error("failed to sign out", err));
  }

  // Best-effort import of this anonymous session's per-expert chat threads
  // into the newly created account, so logging in doesn't discard context.
  // Only meaningful for the email login/signup path — OAuth fully reloads
  // the page first, so there's no in-memory `msgs` state left to send.
  async function importAnonThreads() {
    if (imported.current) return;
    imported.current = true;
    for (const e of EXPERTS) {
      const thread = msgs[e.id];
      if (!thread || thread.length <= 1) continue;
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expertId: e.id,
            campus,
            title: thread.find((m) => m.from === "user")?.text ?? e.label,
            messages: thread.map((m) => ({
              role: m.from,
              content: m.text,
              categoryName: m.categoryName,
              viaWeb: m.viaWeb,
              sources: m.sources,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.id) {
            const expertId = e.id;
            const { id } = data;
            setConversationIds((m) => ({ ...m, [expertId]: id }));
          }
        }
      } catch (err) {
        console.error("anon thread import failed", err); // best-effort only
      }
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
        {session && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="pointer-events-auto bg-[rgba(16,21,36,0.9)] border-2 border-[#2b3450] hover:border-[#3d4a6b] rounded-lg px-3.5 py-2.5 cursor-pointer"
          >
            <span className="font-pixel text-[7px] text-[#f8f6f2]">▤ MY CHATS</span>
          </button>
        )}
        {session && usage && (
          <div
            className={`pointer-events-auto flex items-center bg-[rgba(16,21,36,0.9)] border-2 rounded-[10px] px-3.5 py-2.5 ${
              usage.used >= usage.limit ? "border-[#CC0000]" : "border-[#2b3450]"
            }`}
          >
            <span
              className={`font-pixel text-[7px] ${
                usage.used >= usage.limit ? "text-[#ff6b6b]" : "text-[#8b93a5]"
              }`}
            >
              TODAY {usage.used}/{usage.limit} ▮
            </span>
          </div>
        )}
        {upgradedToast && (
          <div className="pointer-events-auto bg-[rgba(16,21,36,0.9)] border-2 border-[#FFD23F] rounded-[10px] px-3.5 py-2.5">
            <span className="font-pixel text-[7px] text-[#FFD23F]">HUSKY PLUS ACTIVE!</span>
          </div>
        )}
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
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => {
                  setConversationIds((m) => ({ ...m, [activeExpert.id]: undefined }));
                  setMsgs((m) => ({ ...m, [activeExpert.id]: [{ from: "bot", text: activeExpert.greeting }] }));
                  loadedMessages.current.delete(activeExpert.id);
                  msgsEpoch.current[activeExpert.id] = (msgsEpoch.current[activeExpert.id] ?? 0) + 1;
                }}
                className="font-pixel text-[7px] text-[#f8f6f2] bg-[#232b42] hover:bg-[#2b3450] border-2 border-[#2b3450] hover:border-[#3d4a6b] rounded-lg px-3 py-2.5 cursor-pointer whitespace-nowrap"
              >
                + NEW
              </button>
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
              onClick={() => send()}
              disabled={busyId === activeExpert.id || !input.trim()}
              className="flex-none font-pixel text-[10px] text-white bg-[#CC0000] hover:bg-[#e51b1b] disabled:opacity-50 disabled:hover:bg-[#CC0000] border-2 border-[#1a2030] rounded-lg px-4 sm:px-6 cursor-pointer disabled:cursor-default shadow-[0_3px_0_#7a0000] enabled:active:translate-y-[2px] enabled:active:shadow-[0_1px_0_#7a0000]"
            >
              SEND ▶
            </button>
          </div>
        </div>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          importAnonThreads();
          retryPending();
        }}
      />

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} usage={usage} />

      <ChatDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={sortConversations(conversations).map((c) => {
          const expert = EXPERTS.find((e) => e.id === c.expertId);
          return { ...c, sprite: expert?.sprite ?? EXPERTS[0].sprite, label: expert?.label ?? c.expertId };
        })}
        onOpen={handleOpenConversation}
        onPin={handlePinConversation}
        onDelete={handleDeleteConversation}
        usage={usage}
        onManagePlan={handleManagePlan}
        onLogout={handleLogout}
      />
    </div>
  );
}
