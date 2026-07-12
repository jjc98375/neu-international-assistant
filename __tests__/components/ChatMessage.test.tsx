// __tests__/components/ChatMessage.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage, type ChatEntry } from "@/components/ChatMessage";

describe("ChatMessage", () => {
  it("renders the question and answer with category and sources", () => {
    const entry: ChatEntry = {
      question: "How do I get an I-20?",
      answer: "Submit financial docs to OGS.",
      categoryName: "Visa",
      sources: [{ filename: "i20.pdf", preview: "..." }],
    };
    render(<ChatMessage entry={entry} />);
    expect(screen.getByText("How do I get an I-20?")).toBeDefined();
    expect(screen.getByText("Submit financial docs to OGS.")).toBeDefined();
    expect(screen.getByText("Visa")).toBeDefined();
    expect(screen.getByText("i20.pdf")).toBeDefined();
  });

  it("shows a thinking state when pending", () => {
    render(<ChatMessage entry={{ question: "q", pending: true }} />);
    expect(screen.getByText(/thinking/i)).toBeDefined();
  });

  it("shows the error when present", () => {
    render(<ChatMessage entry={{ question: "q", error: "OpenAI down" }} />);
    expect(screen.getByText(/OpenAI down/)).toBeDefined();
  });
});
