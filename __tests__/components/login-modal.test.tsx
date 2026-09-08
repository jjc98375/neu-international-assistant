import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { social: vi.fn(), email: vi.fn() }, signUp: { email: vi.fn() } } }));
import { authClient } from "@/lib/auth-client";
import { LoginModal } from "@/components/LoginModal";

describe("LoginModal", () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.social).mockReset();
    vi.mocked(authClient.signIn.email).mockReset();
    vi.mocked(authClient.signUp.email).mockReset();
  });

  it("renders both OAuth buttons and the email form when open", () => {
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText(/GOOGLE/i)).toBeTruthy();
    expect(screen.getByText(/CONTINUE WITH GITHUB/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
  });
  it("renders nothing when closed", () => {
    const { container } = render(<LoginModal open={false} onClose={() => {}} onSuccess={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("calls signIn.social with {provider: 'google', callbackURL} when the Google button is clicked", async () => {
    vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/CONTINUE WITH GOOGLE/));
    await waitFor(() => {
      expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "google", callbackURL: "/assistant" });
    });
  });

  it("calls signIn.social with {provider: 'github', callbackURL} when the GitHub button is clicked", async () => {
    vi.mocked(authClient.signIn.social).mockResolvedValue({ data: {}, error: null } as never);
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/CONTINUE WITH GITHUB/));
    await waitFor(() => {
      expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: "github", callbackURL: "/assistant" });
    });
  });

  it("renders the OAuth error message when signIn.social resolves with an error", async () => {
    vi.mocked(authClient.signIn.social).mockResolvedValue({
      data: null,
      error: { message: "OAuth provider denied the request" },
    } as never);
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/CONTINUE WITH GOOGLE/));
    expect(await screen.findByText("OAuth provider denied the request")).toBeTruthy();
  });
});
