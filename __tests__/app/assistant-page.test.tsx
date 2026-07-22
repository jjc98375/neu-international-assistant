// __tests__/app/assistant-page.test.tsx
//
// Scoped regression coverage for the login-gate / retry-pending logic and
// (Task 8) the conversation-aware state in src/app/assistant/page.tsx. This
// is one large client component with many unrelated effects (campus picker,
// deep links) — per the Task 7 review, this file intentionally covers only
// the behaviors named in each task's brief and does not attempt a full page
// render/interaction suite.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// page.tsx pulls real fonts from next/font/google; the real module resolves
// to an empty file outside of Next's build-time SWC transform, so calling
// Press_Start_2P(...)/IBM_Plex_Mono(...) would throw. Stub it the same shape
// the component expects: a function returning `{ variable }`.
vi.mock("next/font/google", () => ({
  Press_Start_2P: (opts: { variable: string }) => ({ variable: opts.variable }),
  IBM_Plex_Mono: (opts: { variable: string }) => ({ variable: opts.variable }),
}));

const mockSession: { data: unknown } = { data: null };

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mockSession,
    signIn: { social: vi.fn(), email: vi.fn() },
    signUp: { email: vi.fn() },
  },
}));

import { authClient } from "@/lib/auth-client";
import AssistantPage from "@/app/assistant/page";

describe("AssistantPage — login gate / retry logic", () => {
  beforeEach(() => {
    mockSession.data = null;
    sessionStorage.clear();
    vi.mocked(authClient.signIn.social).mockReset();
    vi.mocked(authClient.signIn.email).mockReset();
    vi.mocked(authClient.signUp.email).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the login modal and drops the optimistic user bubble on a 401 gate response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "login_required", gate: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);

    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    const input = await screen.findByPlaceholderText(/Ask the billing expert/i);
    const question = "Why is my account on hold?";
    fireEvent.change(input, { target: { value: question } });
    fireEvent.click(screen.getByText(/SEND/));

    // Login modal appears (its heading is unique to LoginModal).
    await screen.findByText(/로그인이 필요해요/);
    // The optimistic user bubble that was added on submit gets removed once
    // the gate fires — the just-typed question should no longer be present.
    expect(screen.queryByText(question)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the gated question exactly once after a login-triggered session flip (double-submit guard)", async () => {
    // Branches by URL (rather than call order) because Task 8 makes the
    // login transition also fire a GET /api/conversations fetch (to resume
    // each expert's most recent room) — that call must not be mistaken for,
    // or consume the mock meant for, the retried /api/assistant POST.
    let assistantCallCount = 0;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "/api/conversations") {
        return { ok: true, status: 200, json: async () => ({ conversations: [] }) };
      }
      assistantCallCount++;
      if (assistantCallCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: "login_required", gate: true }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: "Your hold has been cleared.",
          category: "billing",
          categoryName: "Billing",
          sources: [],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const assistantCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/assistant");

    // Email login "succeeds": it resolves with no error (triggering
    // LoginModal's onSuccess -> retryPending()) AND flips the session the
    // component reads via authClient.useSession() (triggering the
    // logged-out -> logged-in effect, which also calls retryPending()).
    // These two triggers can plausibly fire in quick succession, which is
    // exactly the case retryPending()'s internal guard (clearing the
    // pending-question ref before doing anything else) protects against.
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
      return { data: {}, error: null } as never;
    });

    render(<AssistantPage />);

    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    const input = await screen.findByPlaceholderText(/Ask the billing expert/i);
    const question = "Why is my account on hold?";
    fireEvent.change(input, { target: { value: question } });
    fireEvent.click(screen.getByText(/SEND/));

    await screen.findByText(/로그인이 필요해요/);
    expect(assistantCalls()).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "student@northeastern.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByText("로그인"));

    await waitFor(() => expect(assistantCalls()).toHaveLength(2));
    // Flush a tick for any redundant effect-triggered retry to (fail to) run.
    await new Promise((r) => setTimeout(r, 0));
    expect(assistantCalls()).toHaveLength(2);

    const secondCallBody = JSON.parse((assistantCalls()[1]![1] as RequestInit).body as string);
    expect(secondCallBody.question).toBe(question);
  });

  it("on a logged-in session, resumes the most recent room per expert and lazily loads its messages exactly once", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };

    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "/api/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              {
                id: "conv-billing",
                expertId: "billing",
                campus: "boston",
                title: "Why is my account on hold?",
                pinned: false,
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-billing/messages") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { role: "user", content: "Why is my account on hold?", createdAt: "2026-01-01T00:00:01.000Z" },
              {
                role: "bot",
                content: "Your hold has been cleared.",
                categoryName: "Billing",
                viaWeb: false,
                sources: [],
                createdAt: "2026-01-01T00:00:02.000Z",
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch in this test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const messagesCalls = () =>
      fetchMock.mock.calls.filter(([url]) => url === "/api/conversations/conv-billing/messages");

    render(<AssistantPage />);

    // The already-logged-in mount (session starts truthy from render 1, same
    // null->truthy transition the retry-guard test exercises via a live
    // login) fetches the conversation list to learn each expert's room.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/conversations"));

    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));

    // Lazily fetched and rendered — both the historical question and its answer.
    await screen.findByText("Your hold has been cleared.");
    screen.getByText("Why is my account on hold?"); // throws if not rendered
    expect(messagesCalls()).toHaveLength(1);

    // Closing and reopening the same expert must not refetch (cached per
    // expert for the page's lifetime, not refetched on every click).
    fireEvent.click(screen.getByLabelText("Close chat"));
    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    await new Promise((r) => setTimeout(r, 0));
    expect(messagesCalls()).toHaveLength(1);
  });

  it("+ NEW clears the active expert's room so the next send() starts a fresh conversation", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };

    let replyCount = 0;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === "/api/conversations") {
        return { ok: true, status: 200, json: async () => ({ conversations: [] }) };
      }
      replyCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: `Answer ${replyCount}`,
          categoryName: "Billing",
          sources: [],
          conversationId: `conv-${replyCount}`,
          usage: { used: replyCount, limit: 10, tier: "free" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const assistantCalls = () => fetchMock.mock.calls.filter(([url]) => url === "/api/assistant");

    render(<AssistantPage />);
    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    const input = await screen.findByPlaceholderText(/Ask the billing expert/i);

    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.click(screen.getByText(/SEND/));
    await screen.findByText("Answer 1");

    // First message of a fresh expert room carries no conversationId.
    const firstBody = JSON.parse((assistantCalls()[0]![1] as RequestInit).body as string);
    expect(firstBody).not.toHaveProperty("conversationId");

    fireEvent.click(screen.getByText("+ NEW"));

    // Thread resets to just the greeting — the prior Q&A is gone.
    expect(screen.queryByText("First question")).toBeNull();
    expect(screen.queryByText("Answer 1")).toBeNull();

    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.click(screen.getByText(/SEND/));
    await screen.findByText("Answer 2");

    // The conversationId learned from the first exchange (conv-1) must not
    // leak into the next send() now that "+ NEW" was clicked — a stale id
    // here would silently append to the old (now-hidden) room server-side.
    const secondBody = JSON.parse((assistantCalls()[1]![1] as RequestInit).body as string);
    expect(secondBody).not.toHaveProperty("conversationId");
    expect(secondBody.question).toBe("Second question");
  });
});
