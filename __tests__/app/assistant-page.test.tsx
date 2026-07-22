// __tests__/app/assistant-page.test.tsx
//
// Scoped regression coverage for the login-gate / retry-pending logic in
// src/app/assistant/page.tsx. This is one large client component with many
// unrelated effects (campus picker, chat history, deep links) — per the
// review, this file intentionally covers only the two gated-question
// behaviors below and does not attempt a full page render/interaction suite.
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "login_required", gate: true }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          answer: "Your hold has been cleared.",
          category: "billing",
          categoryName: "Billing",
          sources: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(/^Email$/i), {
      target: { value: "student@northeastern.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByText("로그인"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Flush a tick for any redundant effect-triggered retry to (fail to) run.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(secondCallBody.question).toBe(question);
  });
});
