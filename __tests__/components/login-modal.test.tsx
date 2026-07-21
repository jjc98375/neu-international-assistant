import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { social: vi.fn(), email: vi.fn() }, signUp: { email: vi.fn() } } }));
import { LoginModal } from "@/components/LoginModal";

describe("LoginModal", () => {
  it("renders both OAuth buttons and the email form when open", () => {
    render(<LoginModal open onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText(/GOOGLE/i)).toBeTruthy();
    expect(screen.getByText(/NEU 학교 계정/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
  });
  it("renders nothing when closed", () => {
    const { container } = render(<LoginModal open={false} onClose={() => {}} onSuccess={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
