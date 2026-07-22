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
    signOut: vi.fn().mockResolvedValue(undefined),
    subscription: { billingPortal: vi.fn().mockResolvedValue(undefined) },
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
    vi.mocked(authClient.signOut).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(authClient.subscription.billingPortal).mockReset().mockResolvedValue(undefined as never);
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

  // Task 8 fix (Critical): a late-resolving historical-conversation load must
  // not clobber a message that's already in flight for the same expert.
  it("does not let a late historical-conversation load clobber a retried in-flight message", async () => {
    let assistantCallCount = 0;
    let releaseRetryResponse: () => void = () => {};
    const retryGate = new Promise<void>((resolve) => {
      releaseRetryResponse = resolve;
    });
    let resolveMessagesFetched: () => void = () => {};
    const messagesFetched = new Promise<void>((resolve) => {
      resolveMessagesFetched = resolve;
    });

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
                title: "Old room",
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
          json: async () => {
            const body = {
              messages: [
                { role: "user", content: "Old question", createdAt: "2026-01-01T00:00:01.000Z" },
                {
                  role: "bot",
                  content: "Old answer.",
                  categoryName: "Billing",
                  viaWeb: false,
                  sources: [],
                  createdAt: "2026-01-01T00:00:02.000Z",
                },
              ],
            };
            // Signal (after this microtask, i.e. once the component has the
            // parsed body in hand and is about to decide whether to apply
            // it) that the historical load has resolved.
            resolveMessagesFetched();
            return body;
          },
        };
      }
      assistantCallCount++;
      if (assistantCallCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: "login_required", gate: true }) };
      }
      // The retried POST — deliberately held open until the test releases
      // it, so the historical-conversation GETs above resolve first.
      await retryGate;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: "Your hold has been cleared.",
          categoryName: "Billing",
          sources: [],
          conversationId: "conv-billing",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "student@northeastern.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByText("로그인"));

    // Let the historical-conversation load (triggered by the login
    // transition's loadConversationList -> lazy-load effect) resolve and get
    // processed before releasing the retried POST.
    await messagesFetched;
    await new Promise((r) => setTimeout(r, 0));

    // Core regression assertion: the retried question's optimistic bubble
    // must have survived — the historical load resolving first must not
    // have overwritten it. (Unfixed code renders "Old answer." here, having
    // wiped the bubble; the fix must render neither the stale history nor
    // lose the in-flight question.)
    screen.getByText(question); // throws if not rendered
    expect(screen.queryByText("Old answer.")).toBeNull();

    releaseRetryResponse();
    await screen.findByText("Your hold has been cleared.");

    // Still present after the retried POST's reply is appended.
    screen.getByText(question); // throws if not rendered
  });

  // Residual variant of the Task 8 fix above, found in re-review: `msgsEpoch`
  // was previously bumped ONLY at send-start, never when the bot's reply (or
  // an error) is appended. So "epoch unchanged since fetch-start" was not a
  // valid "safe to overwrite" signal — a retried send could complete
  // *entirely* (reply appended, busyIdRef cleared) while the historical load
  // was still in flight, and the epoch never moved through that whole
  // window. This test releases the retried POST FIRST (letting it fully
  // resolve and render) and only THEN releases the already-in-flight
  // historical GET, and asserts the completed exchange survives.
  it("does not let a late historical-conversation load clobber an already-completed retried exchange", async () => {
    let assistantCallCount = 0;

    let releaseRetryResponse: () => void = () => {};
    const retryGate = new Promise<void>((resolve) => {
      releaseRetryResponse = resolve;
    });
    let resolveRetryRequested: () => void = () => {};
    const retryRequested = new Promise<void>((resolve) => {
      resolveRetryRequested = resolve;
    });

    let releaseMessagesResponse: () => void = () => {};
    const messagesGate = new Promise<void>((resolve) => {
      releaseMessagesResponse = resolve;
    });
    let resolveMessagesRequested: () => void = () => {};
    const messagesRequested = new Promise<void>((resolve) => {
      resolveMessagesRequested = resolve;
    });

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
                title: "Old room",
                pinned: false,
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-billing/messages") {
        // Signal that the historical GET is now in flight, then hold it
        // open until the test explicitly releases it — deliberately AFTER
        // the retried POST below has been released and fully resolved.
        resolveMessagesRequested();
        await messagesGate;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { role: "user", content: "Old question", createdAt: "2026-01-01T00:00:01.000Z" },
              {
                role: "bot",
                content: "Old answer.",
                categoryName: "Billing",
                viaWeb: false,
                sources: [],
                createdAt: "2026-01-01T00:00:02.000Z",
              },
            ],
          }),
        };
      }
      assistantCallCount++;
      if (assistantCallCount === 1) {
        return { ok: false, status: 401, json: async () => ({ error: "login_required", gate: true }) };
      }
      // The retried POST — held open until the test releases it, so it's
      // still in flight at the same time as the historical GET above.
      resolveRetryRequested();
      await retryGate;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: "Your hold has been cleared.",
          categoryName: "Billing",
          sources: [],
          conversationId: "conv-billing",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "student@northeastern.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByText("로그인"));

    // Wait until BOTH the retried POST and the historical GET are in flight
    // at the same time (this is the shape of the re-reviewer's repro).
    await Promise.all([retryRequested, messagesRequested]);

    // Release the retried POST first and let it resolve COMPLETELY — reply
    // appended, DOM shows the real Q&A — while the historical GET is still
    // held open.
    releaseRetryResponse();
    await screen.findByText("Your hold has been cleared.");
    screen.getByText(question); // throws if not rendered

    // Now let the stale historical load resolve. Pre-fix, the epoch never
    // moved during the retried send's full lifecycle (bumped only once, at
    // send-start), so `loadConversationMessages`'s "unchanged since
    // fetch-start" guard wrongly treats this as safe and overwrites the
    // completed exchange with the old history.
    releaseMessagesResponse();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // The real, completed exchange must still be present...
    screen.getByText(question); // throws if not rendered
    screen.getByText("Your hold has been cleared."); // throws if not rendered
    // ...and the stale historical Q&A must not have been rendered.
    expect(screen.queryByText("Old question")).toBeNull();
    expect(screen.queryByText("Old answer.")).toBeNull();
  });

  // Task 8 fix (Important #2): the server includes a `usage` snapshot on a
  // 429 quota_exceeded response (same shape as the success path) — the
  // component must still read it, not just on `res.ok`.
  it("reads `usage` off a 429 quota_exceeded response body without crashing", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/conversations") {
        return { ok: true, status: 200, json: async () => ({ conversations: [] }) };
      }
      return {
        ok: false,
        status: 429,
        json: async () => ({
          error: "quota_exceeded",
          usage: { used: 10, limit: 10, tier: "free" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    const input = await screen.findByPlaceholderText(/Ask the billing expert/i);
    fireEvent.change(input, { target: { value: "One more question?" } });
    fireEvent.click(screen.getByText(/SEND/));

    // There is no data-testid or other visible surface exposing `usage` in
    // the UI yet (Task 10 owns the usage widget) — this test asserts the
    // reachable floor: reading `data.usage` on a 429 body doesn't crash the
    // component, the 429 goes through the generic error-bubble path (not the
    // 401 login-gate path), and the endpoint was hit exactly once. The
    // `setUsage(data.usage)` call itself is exercised by this same code path
    // (see the unconditional `if (data?.usage) setUsage(data.usage);` in
    // send()); it isn't independently observable from the DOM at this stage.
    await screen.findByText(/Something went wrong on my desk \(quota_exceeded\)/);
    expect(screen.queryByText(/로그인이 필요해요/)).toBeNull();
    const assistantCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/assistant");
    expect(assistantCalls).toHaveLength(1);
  });

  // Task 8 fix (Important #3): importAnonThreads() must feed the id it gets
  // back from POST /api/conversations into conversationIds, so the next
  // send() for that expert continues the just-imported room server-side.
  it("wires the id returned by importAnonThreads()'s POST into conversationIds for that expert's next send()", async () => {
    const assistantCallCounts: Record<string, number> = {};
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/conversations" && (!init || !init.method || init.method === "GET")) {
        return { ok: true, status: 200, json: async () => ({ conversations: [] }) };
      }
      if (url === "/api/conversations" && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return { ok: true, status: 200, json: async () => ({ id: `conv-imported-${body.expertId}` }) };
      }
      if (/^\/api\/conversations\/.+\/messages$/.test(url)) {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) };
      }
      if (url === "/api/assistant") {
        const body = JSON.parse(init!.body as string);
        assistantCallCounts[body.expertId] = (assistantCallCounts[body.expertId] ?? 0) + 1;
        if (body.expertId === "billing" && assistantCallCounts.billing === 1) {
          return { ok: false, status: 401, json: async () => ({ error: "login_required", gate: true }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            answer: `Answer for ${body.expertId} #${assistantCallCounts[body.expertId]}`,
            categoryName: "Billing",
            sources: [],
          }),
        };
      }
      throw new Error(`unexpected fetch in this test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
      return { data: {}, error: null } as never;
    });

    render(<AssistantPage />);

    // Build up an anonymous thread on the visa expert that's eligible for
    // import (length > 1: greeting + question + answer).
    fireEvent.click(screen.getByLabelText(/Chat with the Visa expert/i));
    let input = await screen.findByPlaceholderText(/Ask the visa expert/i);
    fireEvent.change(input, { target: { value: "Visa question one" } });
    fireEvent.click(screen.getByText(/SEND/));
    await screen.findByText(/Answer for visa #1/);

    // Gate a billing question so the login modal opens (its own thread gets
    // sliced back to length 1 by the gate, so it's not itself imported).
    fireEvent.click(screen.getByLabelText(/Chat with the Billing expert/i));
    input = await screen.findByPlaceholderText(/Ask the billing expert/i);
    fireEvent.change(input, { target: { value: "Billing question" } });
    fireEvent.click(screen.getByText(/SEND/));
    await screen.findByText(/로그인이 필요해요/);

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "student@northeastern.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByText("로그인"));

    // Login success fires importAnonThreads() (imports the visa thread) and
    // retryPending() (retries the billing question) — wait for the retry's
    // reply as a signal the whole login sequence has settled.
    await screen.findByText(/Answer for billing #2/);

    // Switch back to visa and send a follow-up: its conversationId should
    // now be the id importAnonThreads() got back from the server, not absent.
    fireEvent.click(screen.getByLabelText(/Chat with the Visa expert/i));
    input = await screen.findByPlaceholderText(/Ask the visa expert/i);
    fireEvent.change(input, { target: { value: "Visa question two" } });
    fireEvent.click(screen.getByText(/SEND/));
    await screen.findByText(/Answer for visa #2/);

    const visaCalls = fetchMock.mock.calls.filter(([url, init]) => {
      if (url !== "/api/assistant" || !(init as RequestInit)?.body) return false;
      const body = JSON.parse((init as RequestInit).body as string);
      return body.expertId === "visa";
    });
    expect(visaCalls).toHaveLength(2);
    const secondVisaBody = JSON.parse((visaCalls[1]![1] as RequestInit).body as string);
    expect(secondVisaBody.conversationId).toBe("conv-imported-visa");
  });
});

// Task 9: the "▤ MY CHATS" history drawer — chip visibility, the
// sortConversations wiring between the fetched list and the drawer, and the
// pin/delete/open handlers' REST calls and optimistic-UI reconciliation.
describe("AssistantPage — history drawer (Task 9)", () => {
  beforeEach(() => {
    mockSession.data = null;
    sessionStorage.clear();
    vi.mocked(authClient.signIn.social).mockReset();
    vi.mocked(authClient.signIn.email).mockReset();
    vi.mocked(authClient.signUp.email).mockReset();
    vi.mocked(authClient.signOut).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(authClient.subscription.billingPortal).mockReset().mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only renders the ▤ MY CHATS chip when logged in", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ conversations: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssistantPage />);
    expect(screen.queryByText("▤ MY CHATS")).toBeNull();
  });

  it("sorts pinned conversations before more-recent unpinned ones in the drawer (sortConversations wiring)", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              // Server order deliberately puts the newer, unpinned room first —
              // if the drawer just rendered fetch order verbatim (skipping
              // sortConversations) this test would fail.
              {
                id: "unpinned-recent", expertId: "billing", campus: "boston",
                title: "Unpinned but newer", pinned: false, updatedAt: "2026-07-20T00:00:00.000Z",
              },
              {
                id: "pinned-older", expertId: "visa", campus: "boston",
                title: "Pinned but older", pinned: true, updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch in this test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/conversations"));

    fireEvent.click(screen.getByText("▤ MY CHATS"));
    await screen.findByText("Unpinned but newer");

    const titles = screen.getAllByText(/^(Unpinned but newer|Pinned but older)$/).map((el) => el.textContent);
    expect(titles.indexOf("Pinned but older")).toBeLessThan(titles.indexOf("Unpinned but newer"));
  });

  it("clicking pin in the drawer PATCHes /api/conversations/:id with the toggled pinned value", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/conversations" && (!init || !init.method || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              {
                id: "conv-1", expertId: "billing", campus: "boston",
                title: "Why is my account on hold?", pinned: false, updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-1" && init?.method === "PATCH") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch in this test: ${url} ${init?.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/conversations"));
    fireEvent.click(screen.getByText("▤ MY CHATS"));
    await screen.findByText("Why is my account on hold?");

    fireEvent.click(screen.getByLabelText("Pin conversation"));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([u, i]) => u === "/api/conversations/conv-1" && (i as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ pinned: true });
    });
  });

  it("reconciles the drawer via a refetch when a pin PATCH fails", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    let listCallCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/conversations" && (!init || !init.method || init.method === "GET")) {
        listCallCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              {
                id: "conv-1", expertId: "billing", campus: "boston",
                title: "Why is my account on hold?", pinned: false, updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-1" && init?.method === "PATCH") {
        return { ok: false, status: 404, json: async () => ({ error: "not_found" }) };
      }
      throw new Error(`unexpected fetch in this test: ${url} ${init?.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    await waitFor(() => expect(listCallCount).toBe(1));
    fireEvent.click(screen.getByText("▤ MY CHATS"));
    await screen.findByText("Why is my account on hold?");

    fireEvent.click(screen.getByLabelText("Pin conversation"));

    // A failed PATCH must not leave the drawer silently diverged from the
    // server — it refetches the authoritative list instead.
    await waitFor(() => expect(listCallCount).toBe(2));
  });

  it("delete in the drawer requires a second confirming click before DELETE fires", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/conversations" && (!init || !init.method || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              {
                id: "conv-1", expertId: "billing", campus: "boston",
                title: "Why is my account on hold?", pinned: false, updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-1" && init?.method === "DELETE") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch in this test: ${url} ${init?.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/conversations"));
    fireEvent.click(screen.getByText("▤ MY CHATS"));
    await screen.findByText("Why is my account on hold?");

    fireEvent.click(screen.getByLabelText("Delete conversation"));
    const deleteCallsBeforeConfirm = fetchMock.mock.calls.filter(
      ([u, i]) => u === "/api/conversations/conv-1" && (i as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCallsBeforeConfirm).toHaveLength(0);

    fireEvent.click(screen.getByText("정말 삭제?"));
    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        ([u, i]) => u === "/api/conversations/conv-1" && (i as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });

  it("clicking a conversation row resumes that room (opens the matching expert's chat popup) and closes the drawer", async () => {
    mockSession.data = { user: { id: "u1", email: "student@northeastern.edu" } };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              {
                id: "conv-visa-1", expertId: "visa", campus: "boston",
                title: "Do I need a new I-20?", pinned: false, updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (url === "/api/conversations/conv-visa-1/messages") {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) };
      }
      throw new Error(`unexpected fetch in this test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/conversations"));
    fireEvent.click(screen.getByText("▤ MY CHATS"));
    fireEvent.click(await screen.findByText("Do I need a new I-20?"));

    // The visa expert's chat popup opened for the resumed room...
    await screen.findByPlaceholderText(/Ask the visa expert/i);
    // ...and the drawer closed (its own close button is no longer present).
    expect(screen.queryByLabelText("Close chat history")).toBeNull();
  });
});
