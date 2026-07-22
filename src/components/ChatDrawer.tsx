"use client";

import { useEffect, useState } from "react";

// Shape the page hands down to each row: the raw conversation-history fields
// (Task 6/9's API surface) plus the sprite id / label resolved from the
// page's EXPERTS roster (EXPERTS/SPRITES live in page.tsx, not here, so the
// caller does that lookup once per conversation before passing the list in).
export interface DrawerConversation {
  id: string;
  expertId: string;
  campus?: string | null;
  title: string;
  pinned: boolean;
  updatedAt: string;
  /** key into page.tsx's SPRITES map, rendered here via <use href="#sp-…"> */
  sprite: string;
  label: string;
}

export function ChatDrawer({
  open,
  onClose,
  conversations,
  onOpen,
  onPin,
  onDelete,
  usage,
  onManagePlan,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  /** Already sorted (pinned first, most-recent next) — the caller runs this
   *  through sortConversations() before passing it in. */
  conversations: DrawerConversation[];
  onOpen: (convo: DrawerConversation) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  usage: { used: number; limit: number; tier: string } | null;
  onManagePlan: () => void;
  onLogout: () => void;
}) {
  // Per-row "are you sure?" state for delete — a row must be clicked twice
  // (first click arms it, second click within the same armed row deletes)
  // so a stray click can never destroy a conversation in one shot.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drop any pending delete-confirmation when the drawer closes, so
  // reopening it never resumes an armed "정말 삭제?" state on a row the user
  // may not even remember clicking.
  useEffect(() => {
    if (!open) setConfirmId(null);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click to close. Sits below the panel (z-249 < z-250) and
          above everything else on the page (quad, chat popup at z-200). */}
      <div className="fixed inset-0 z-[249] bg-[rgba(10,14,25,0.55)]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-label="My chats"
        className="quad-drawer font-plex fixed inset-y-0 left-0 z-[250] w-[320px] max-w-[85vw] flex flex-col bg-[#12172a] border-r-2 border-[#2b3450] shadow-[10px_0_34px_rgba(10,14,25,0.5)]"
      >
        {/* Header */}
        <div className="flex-none flex items-center gap-3 px-4 py-3.5 bg-[#1a2030] border-b-2 border-[#2b3450]">
          <span className="font-pixel text-[10px] text-[#FFD23F]">▤ MY CHATS</span>
          <button
            onClick={onClose}
            aria-label="Close chat history"
            className="ml-auto flex-none w-8 h-8 bg-[#CC0000] hover:bg-[#e51b1b] border-2 border-[#7a0000] rounded-md cursor-pointer grid place-items-center"
          >
            {/* pixel-art X — same icon used by the chat popup's close button */}
            <svg width={16} height={16} viewBox="0 0 7 7" style={{ shapeRendering: "crispEdges" }} aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <rect key={i} x={i} y={i} width={1} height={1} fill="#ffffff" />
              ))}
              {[0, 1, 2, 4, 5, 6].map((i) => (
                <rect key={`a${i}`} x={6 - i} y={i} width={1} height={1} fill="#ffffff" />
              ))}
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 font-plex text-[13px] text-[#5b6480] text-center leading-relaxed">
              No conversations yet — ask an expert something to start one.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(c)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onOpen(c);
                  }
                }}
                onMouseLeave={() => {
                  // Re-arming requires a fresh click — leaving the row cancels
                  // an in-progress delete confirmation rather than leaving it
                  // primed for whenever the cursor happens to return.
                  if (confirmId === c.id) setConfirmId(null);
                }}
                className="group flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#232b42] hover:bg-[#1a2030] cursor-pointer outline-none focus-visible:bg-[#1a2030]"
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 10 10"
                  className="flex-none block"
                  style={{ shapeRendering: "crispEdges" }}
                  aria-hidden
                >
                  <use href={`#sp-${c.sprite}`} />
                </svg>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {c.pinned && (
                      <span className="flex-none text-[10px]" aria-hidden>
                        📌
                      </span>
                    )}
                    <span className="font-plex text-[13px] text-[#f8f6f2] truncate">{c.title || c.label}</span>
                  </div>
                  <div className="font-pixel text-[6px] text-[#8b93a5] mt-1.5">{relativeTime(c.updatedAt)}</div>
                </div>

                {/* Row actions — hidden until hover/focus so the list reads
                    clean at rest, per this app's established row-hover pattern. */}
                <div className="flex-none flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onPin(c.id, !c.pinned);
                    }}
                    aria-label={c.pinned ? "Unpin conversation" : "Pin conversation"}
                    className="w-7 h-7 grid place-items-center rounded-md border-2 border-[#2b3450] hover:border-[#FFD23F] bg-[#1a2030] cursor-pointer text-[11px] leading-none"
                  >
                    📌
                  </button>
                  {confirmId === c.id ? (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDelete(c.id);
                        setConfirmId(null);
                      }}
                      className="font-pixel text-[6px] text-white bg-[#CC0000] hover:bg-[#e51b1b] border-2 border-[#7a0000] rounded-md px-2 py-2 cursor-pointer whitespace-nowrap"
                    >
                      정말 삭제?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setConfirmId(c.id);
                      }}
                      aria-label="Delete conversation"
                      className="w-7 h-7 grid place-items-center rounded-md border-2 border-[#2b3450] hover:border-[#CC0000] bg-[#1a2030] cursor-pointer text-[11px] leading-none text-[#f8f6f2]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: usage + plan management + logout */}
        <div className="flex-none border-t-2 border-[#2b3450] bg-[#0f1322] px-4 py-3.5 flex flex-col gap-2.5">
          {usage && (
            <div className="font-pixel text-[7px] text-[#8b93a5]">
              TODAY {usage.used}/{usage.limit}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onManagePlan}
              className="flex-1 font-pixel text-[7px] text-[#1a2030] bg-[#FFD23F] hover:bg-[#ffdf70] border-2 border-[#1a2030] rounded-lg px-3 py-2.5 cursor-pointer"
            >
              PLAN 관리
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 font-pixel text-[7px] text-[#f8f6f2] bg-[#232b42] hover:bg-[#2b3450] border-2 border-[#2b3450] rounded-lg px-3 py-2.5 cursor-pointer"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Compact English relative-time chrome (matches the rest of the drawer/quad's
// pixel-font labels — "5 EXPERTS ON DUTY", "TODAY X/Y" — Korean is reserved
// for conversational/dialog copy like the delete confirmation above).
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
