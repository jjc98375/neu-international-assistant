"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ChatMessage, type ChatEntry } from "@/components/ChatMessage";
import { AVAILABLE_CATEGORIES, CATEGORY_KEYS } from "@/lib/rag-categories";

export default function AssistantPage() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("auto");
  const [busy, setBusy] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const id = crypto.randomUUID();
    setEntries((e) => [...e, { id, question, pending: true }]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category }),
      });
      const data = await res.json();
      setEntries((e) =>
        e.map((entry) =>
          entry.id === id
            ? res.ok
              ? { id, question, answer: data.answer, categoryName: data.categoryName, sources: data.sources }
              : { id, question, error: data.error ?? `HTTP ${res.status}` }
            : entry,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEntries((e) => e.map((entry) => (entry.id === id ? { id, question, error: msg } : entry)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">International Student Assistant</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ask about visas, billing, employment, courses, and more.
        </p>
      </div>

      <div className="space-y-4 min-h-[40vh]">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Ask a question to get started.</p>
        ) : (
          entries.map((entry, i) => <ChatMessage key={entry.id ?? i} entry={entry} />)
        )}
      </div>

      <div className="flex items-center gap-2 sticky bottom-4">
        <select
          className="border border-slate-300 dark:border-[#243049] rounded-lg px-2 py-2 text-sm bg-white dark:bg-[#161c2d]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="auto">Auto</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>{AVAILABLE_CATEGORIES[k]}</option>
          ))}
        </select>
        <input
          className="flex-1 border border-slate-300 dark:border-[#243049] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#161c2d] focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={busy}
        />
        <button
          className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg p-2 disabled:opacity-50"
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
