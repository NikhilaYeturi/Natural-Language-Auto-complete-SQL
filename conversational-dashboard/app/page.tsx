"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SuggestionModal from "./components/SuggestionModal";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

interface NLSuggestion {
  nlCompletion: string;
  description: string;
  sqlQuery?: string;
}

interface HistoryItem {
  naturalText: string;
  sqlQuery?: string;
  rowCount?: number;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();

  const [conversation, setConversation] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! Ask me anything about your expenses.",
    },
  ]);

  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [sqlSuggestions, setSqlSuggestions] = useState<any[]>([]);

  const [nlSuggestions, setNlSuggestions] = useState<NLSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [showUserHistory, setShowUserHistory] = useState(true);
  const [showQueryHistory, setShowQueryHistory] = useState(true);

  useEffect(() => {
    if (!historyOpen) return;

    async function loadHistory() {
      try {
        const res = await fetch("/api/query-history");
        const data = await res.json();
  const q = (data || []).filter((d: any) => d.sqlQuery && d.sqlQuery.trim() !== "");
  q.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  setQueryHistory(q);
      } catch {
        setQueryHistory([]);
      }
    }
    loadHistory();

    async function loadUserHistory() {
      try {
        const res = await fetch('/api/store-user-history');
        const data = await res.json();
  const u = (data || []);
  u.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  setUserHistory(u);
      } catch {
        setUserHistory([]);
      }
    }
    loadUserHistory();
  }, [historyOpen]);

  /* =====================================================
     NATURAL LANGUAGE SUGGESTIONS (Debounced)
  ====================================================== */
  // useEffect(() => {
  //   const trimmed = userInput.trim();
  //   if (trimmed.length < 3) {
  //     setNlSuggestions([]);
  //     return;
  //   }

  //   // Slightly longer debounce to reduce rapid OpenAI calls (milliseconds)
  //   const DEBOUNCE_MS = 200;

  //   let cancelled = false;
  //   let controller: AbortController | null = null;

  //   const timeout = setTimeout(async () => {
  //     try {
  //       setSuggestLoading(true);

  //       controller = new AbortController();

  //       const res = await fetch("/api/nl-suggest", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({ userInput: trimmed, conversation }),
  //         signal: controller.signal,
  //       });

  //       if (!cancelled) {
  //         const data = await res.json();
  //         setNlSuggestions(Array.isArray(data) ? data : []);
  //       }
  //     } catch (err: any) {
  //       // Ignore aborts – they are expected when user types again
  //       if (err && err.name === "AbortError") {
  //         // do nothing
  //       } else {
  //         console.error("NL suggestion fetch error:", err);
  //       }
  //     } finally {
  //       if (!cancelled) setSuggestLoading(false);
  //     }
  //   }, DEBOUNCE_MS);

  //   return () => {
  //     cancelled = true;
  //     clearTimeout(timeout);
  //     if (controller) controller.abort();
  //   };
  // }, [userInput, conversation]);

  useEffect(() => {
  const trimmed = userInput.trim();

  // No suggestions for short text
  if (trimmed.length < 3) {
    setNlSuggestions([]);
    return;
  }

  let cancelled = false;

  const timeout = setTimeout(async () => {
    try {
      const res = await fetch("/api/nl-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: trimmed }),
      });

      if (!cancelled) {
        const data = await res.json();
        setNlSuggestions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("NL Suggest Error:", err);
      if (!cancelled) setNlSuggestions([]);
    }
  }, 200); // 

  return () => {
    cancelled = true;
    clearTimeout(timeout);
  };
}, [userInput]);


  
    // RUN QUERY WHEN PRESSING ENTER
  const handleKeyDown = async (e: any) => {
  // Enter should act like the Send button
  if (e.key !== "Enter") return;
  if (e.shiftKey) return; // allow newline
  e.preventDefault();

  // Delegate to the same send flow used by the Send button
  const clean = userInput.trim();
  if (!clean) return;

  await handleSend();
  };

    // SEND BUTTON → SQL AUTOCOMPLETE MODAL
  const handleSend = async () => {
    if (!userInput.trim()) return;

    const clean = userInput.trim();

    setConversation((prev) => [...prev, { role: "user", text: clean }]);
    setLoading(true);

    try {
      await fetch("/api/store-user-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naturalText: clean,
          createdAt: new Date().toISOString(),
        }),
      });
      // Optimistically update UI so newest appears first without needing to re-open history
      setUserHistory((prev) => [
        { naturalText: clean, createdAt: new Date().toISOString(), id: `u-${Date.now()}` },
        ...prev,
      ]);
    } catch {}

    try {
      const sqlRes = await fetch("/api/sql-autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: clean,
          conversationHistory: conversation,
        }),
      });

      const sqlData = await sqlRes.json();
      setSqlSuggestions(sqlData || []);
      setModalOpen(true);

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            sqlData?.length > 0
              ? `I generated ${sqlData.length} SQL suggestion(s).`
              : "No SQL suggestions available.",
        },
      ]);
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Error generating suggestions." },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-10 relative">
      <h1 className="text-3xl font-bold mb-6">Conversational Analyst</h1>

      {/* CHAT */}
      <div className="bg-[#0f172a] p-6 rounded-2xl w-full max-w-2xl mb-6 shadow-lg">
        <div className="h-[260px] overflow-y-auto space-y-3 pr-2 mb-4">
          {conversation.map((msg, idx) => (
            <div
              key={idx}
              className={`px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-50"
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: msg.text }} />
            </div>
          ))}
        </div>

        {/* NL SUGGESTIONS */}
        {nlSuggestions.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-slate-400">Suggestions:</p>

            {nlSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const ta = textareaRef.current;
                  if (ta) {
                    const start = ta.selectionStart ?? ta.value.length;
                    const end = ta.selectionEnd ?? ta.value.length;
                    const before = ta.value.slice(0, start);
                    const after = ta.value.slice(end);

                    const tokenMatch = before.match(/(\S+)$/);
                    const token = tokenMatch ? tokenMatch[1] : "";

                    if (token && s.nlCompletion.toLowerCase().startsWith(token.toLowerCase())) {
                      const suffix = s.nlCompletion.slice(token.length);
                      const needsSpace = !/\s$/.test(before) && !/^\s/.test(suffix);
                      const inserted = (before || "") + (needsSpace ? " " : "") + suffix;
                      const newValue = inserted + (after ? (after.startsWith(" ") ? after : " " + after) : "");
                      setUserInput(newValue);

                      requestAnimationFrame(() => {
                        if (!ta) return;
                        ta.focus();
                        const caret = (before || "").length + (needsSpace ? 1 : 0) + suffix.length;
                        ta.setSelectionRange(caret, caret);
                      });
                    } else {
                      const insert = (before.replace(/\s+$/g, "") ? before.replace(/\s+$/g, "") + " " : "") + s.nlCompletion;
                      const newValue = insert + (after ? " " + after.replace(/^\s+/, "") : "");
                      setUserInput(newValue);

                      requestAnimationFrame(() => {
                        if (!ta) return;
                        ta.focus();
                        const caret = insert.length;
                        ta.setSelectionRange(caret, caret);
                      });
                    }
                  } else {
                    setUserInput((prev) => {
                      const base = prev.replace(/\s+$/g, "");
                      if (!base) return s.nlCompletion;
                      return `${base} ${s.nlCompletion}`;
                    });
                  }
                }}
                className="w-full text-left bg-blue-600/80 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm"
              >
                <div className="font-medium">{s.nlCompletion}</div>
                <div className="text-[11px] text-blue-100 mt-1">
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef as any}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me the expenses of..."
          className="w-full mt-2 p-3 rounded bg-gray-900 border border-gray-700"
        />

        <button
          onClick={handleSend}
          disabled={loading}
          className="mt-4 bg-amber-600 hover:bg-amber-700 px-5 py-2 rounded"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>

      {/* SQL MODAL */}
      <SuggestionModal
        isOpen={modalOpen}
        suggestions={sqlSuggestions}
        onClose={() => setModalOpen(false)}
        onSelect={async (sql) => {
          setModalOpen(false);

          const res = await fetch("/api/run-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql }),
          });

          const out = await res.json();

          router.push(
            `/results?sql=${encodeURIComponent(
              out.sql
            )}&rows=${encodeURIComponent(JSON.stringify(out.rows))}`
          );
        }}
      />

      {/* HISTORY BUTTON */}
      {!historyOpen && (
        <button
          onClick={() => setHistoryOpen(true)}
          className="fixed right-10 top-1/2 -translate-y-1/2 bg-amber-600 hover:bg-amber-700 px-6 py-3 rounded text-white shadow-lg"
        >
          View Histories
        </button>
      )}

      {/* HISTORY PANEL */}
      {historyOpen && (
        <div className="fixed top-0 right-0 h-full w-[700px] bg-gray-900 border-l border-gray-700 p-4 overflow-y-auto z-50 flex">
          <div className="w-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Histories</h2>
              <div className="space-x-2">
                <button
                  onClick={() => setShowUserHistory((s) => !s)}
                  className={`px-3 py-1 rounded ${showUserHistory ? 'bg-green-600' : 'bg-gray-700'}`}
                >
                  User History
                </button>
                <button
                  onClick={() => setShowQueryHistory((s) => !s)}
                  className={`px-3 py-1 rounded ${showQueryHistory ? 'bg-blue-600' : 'bg-gray-700'}`}
                >
                  Query History
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              {/* User History Column */}
              <div className="w-1/2 overflow-y-auto max-h-[80vh] pr-2">
                <h3 className="text-sm text-green-300 mb-2">User History</h3>
                {!showUserHistory ? (
                  <p className="text-gray-500">Hidden</p>
                ) : userHistory.length === 0 ? (
                  <p className="text-gray-400">No user history.</p>
                ) : (
                  userHistory.map((u: any, i: number) => (
                    <div key={u.id || i} className="bg-gray-800 p-3 rounded-lg mb-2">
                      <p className="text-white text-sm">{u.naturalText}</p>
                      {/* createdAt hidden intentionally */}
                    </div>
                  ))
                )}
              </div>

              {/* Query History Column */}
              <div className="w-1/2 overflow-y-auto max-h-[80vh] pl-2">
                <h3 className="text-sm text-blue-300 mb-2">Query History</h3>
                {!showQueryHistory ? (
                  <p className="text-gray-500">Hidden</p>
                ) : queryHistory.length === 0 ? (
                  <p className="text-gray-400">No queries yet.</p>
                ) : (
                  queryHistory.map((item, idx) => (
                    <div key={idx} className="bg-gray-800 p-3 rounded-lg mb-2">
                      <pre className="whitespace-pre-wrap text-sm mt-1">{item.sqlQuery}</pre>
                      <p className="text-gray-300 text-sm mt-1">Rows: {item.rowCount}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
