// src/components/ChatMessage.tsx
"use client";

export interface ChatEntry {
  id?: string;
  question: string;
  answer?: string;
  categoryName?: string;
  sources?: { filename: string; preview: string }[];
  error?: string;
  pending?: boolean;
}

export function ChatMessage({ entry }: { entry: ChatEntry }) {
  return (
    <div className="space-y-2">
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-red-600 dark:bg-red-500 text-white px-3 py-2 text-sm">
          {entry.question}
        </div>
      </div>

      {/* Assistant response */}
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-lg bg-white dark:bg-[#161c2d] border border-slate-200 dark:border-[#243049] px-3 py-2 text-sm text-slate-900 dark:text-slate-100">
          {entry.pending && <span className="text-slate-400">Thinking…</span>}

          {entry.error && (
            <span className="text-red-600 dark:text-red-400">Error: {entry.error}</span>
          )}

          {entry.answer && (
            <>
              {entry.categoryName && (
                <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>Category: </span><span>{entry.categoryName}</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{entry.answer}</p>

              {entry.sources && entry.sources.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
                    Sources ({entry.sources.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {entry.sources.map((s) => (
                      <li key={s.filename} className="text-xs">
                        <span className="font-medium">{s.filename}</span>
                        {/^https?:\/\//.test(s.preview) ? (
                          <a
                            href={s.preview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-500 hover:underline truncate"
                          >
                            {s.preview}
                          </a>
                        ) : (
                          <span className="block text-slate-400 truncate">{s.preview}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
