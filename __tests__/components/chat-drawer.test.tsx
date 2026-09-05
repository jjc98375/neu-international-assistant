import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatDrawer, type DrawerConversation } from "@/components/ChatDrawer";

const noop = () => {};

function convo(overrides: Partial<DrawerConversation> = {}): DrawerConversation {
  return {
    id: "c1",
    expertId: "billing",
    campus: "boston",
    title: "Why is my account on hold?",
    pinned: false,
    updatedAt: "2026-07-01T00:00:00Z",
    sprite: "billing",
    label: "Billing",
    ...overrides,
  };
}

describe("ChatDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ChatDrawer
        open={false}
        onClose={noop}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the header and each conversation's title, pinned first in whatever order it's given", () => {
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[convo({ id: "a", title: "Room A", pinned: true }), convo({ id: "b", title: "Room B", pinned: false })]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    expect(screen.getByText("▤ MY CHATS")).toBeTruthy();
    expect(screen.getByText("Room A")).toBeTruthy();
    expect(screen.getByText("Room B")).toBeTruthy();
  });

  it("shows an empty state when there are no conversations", () => {
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    expect(screen.getByText(/No conversations yet/)).toBeTruthy();
  });

  it("clicking a row calls onOpen with that conversation", () => {
    const onOpen = vi.fn();
    const c = convo({ id: "room-1", title: "Ask about OPT" });
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[c]}
        onOpen={onOpen}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.click(screen.getByText("Ask about OPT"));
    expect(onOpen).toHaveBeenCalledWith(c);
  });

  it("clicking the pin button on an unpinned row calls onPin(id, true) and does not also trigger onOpen", () => {
    const onPin = vi.fn();
    const onOpen = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[convo({ id: "room-1", pinned: false })]}
        onOpen={onOpen}
        onPin={onPin}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Pin conversation"));
    expect(onPin).toHaveBeenCalledWith("room-1", true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("clicking the pin button on an already-pinned row calls onPin(id, false)", () => {
    const onPin = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[convo({ id: "room-1", pinned: true })]}
        onOpen={noop}
        onPin={onPin}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Unpin conversation"));
    expect(onPin).toHaveBeenCalledWith("room-1", false);
  });

  it("delete requires a second confirming click before calling onDelete (not a single click)", () => {
    const onDelete = vi.fn();
    const onOpen = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[convo({ id: "room-1" })]}
        onOpen={onOpen}
        onPin={noop}
        onDelete={onDelete}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Delete conversation"));
    expect(onDelete).not.toHaveBeenCalled();

    // The ✕ button is replaced by a Korean confirm prompt — clicking it is
    // the second, confirming click.
    fireEvent.click(screen.getByText("DELETE?"));
    expect(onDelete).toHaveBeenCalledWith("room-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("moving the mouse off an armed row cancels the pending delete confirmation", () => {
    const onDelete = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[convo({ id: "room-1" })]}
        onOpen={noop}
        onPin={noop}
        onDelete={onDelete}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    const deleteButton = screen.getByLabelText("Delete conversation");
    fireEvent.click(deleteButton);
    expect(screen.getByText("DELETE?")).toBeTruthy();

    fireEvent.mouseLeave(deleteButton.closest('[role="button"]')!);
    expect(screen.queryByText("DELETE?")).toBeNull();
    expect(screen.getByLabelText("Delete conversation")).toBeTruthy();
  });

  it("shows TODAY used/limit from usage and wires the MANAGE PLAN / LOGOUT buttons", () => {
    const onManagePlan = vi.fn();
    const onLogout = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={{ used: 3, limit: 10, tier: "free" }}
        onManagePlan={onManagePlan}
        onLogout={onLogout}
      />,
    );
    expect(screen.getByText(/TODAY 3\/10/)).toBeTruthy();
    fireEvent.click(screen.getByText("MANAGE PLAN"));
    expect(onManagePlan).toHaveBeenCalled();
    fireEvent.click(screen.getByText("LOGOUT"));
    expect(onLogout).toHaveBeenCalled();
  });

  it("omits the usage line when usage is null", () => {
    render(
      <ChatDrawer
        open
        onClose={noop}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    expect(screen.queryByText(/TODAY/)).toBeNull();
  });

  it("calls onClose when the header close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={onClose}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close chat history"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <ChatDrawer
        open
        onClose={onClose}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ChatDrawer
        open
        onClose={onClose}
        conversations={[]}
        onOpen={noop}
        onPin={noop}
        onDelete={noop}
        usage={null}
        onManagePlan={noop}
        onLogout={noop}
      />,
    );
    const dialog = screen.getByRole("dialog");
    // The backdrop is the sibling rendered just before the dialog panel.
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(container.contains(backdrop)).toBe(true);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
