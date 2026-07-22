import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// vi.mock's factory is hoisted above all module-scope code, so a plain
// `const upgrade = vi.fn()` referenced inside it hits a TDZ ReferenceError at
// runtime ("Cannot access 'upgrade' before initialization") — Vitest only
// hoists declarations alongside the mock call when they're wrapped in
// vi.hoisted(). Same fn/assertions as the brief's literal snippet, just with
// the hoisting-safe wrapper vi.mock requires.
const { upgrade } = vi.hoisted(() => ({ upgrade: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { subscription: { upgrade } } }));
import { PaywallModal } from "@/components/PaywallModal";

it("shows both plans and requests the chosen upgrade", () => {
  render(<PaywallModal open onClose={() => {}} usage={{ used: 10, limit: 10, tier: "free" }} />);
  expect(screen.getByText(/\$9\.99/)).toBeTruthy();
  expect(screen.getByText(/\$49\.99/)).toBeTruthy();
  fireEvent.click(screen.getByText(/HUSKY PLUS/i));
  expect(upgrade).toHaveBeenCalledWith(expect.objectContaining({ plan: "plus" }));
});
