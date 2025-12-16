"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

type Stage = "chat" | "objective" | "optimizing" | "sql";

export default function Home() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // CORE STATE
  const [stage, setStage] = useState<Stage>("chat");
  const [conversation, setConversation] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hello there! \n How can I help you today." },
  ]);

  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);

    // OBJECTIVE FUNCTION
  const [objectiveAst, setObjectiveAst] = useState<any | null>(null);
  const [objectiveLocked, setObjectiveLocked] = useState(false);

 
     //SQL
  const [sql, setSql] = useState("");
  const [queryResults, setQueryResults] = useState<any[] | null>(null);

     //SEND / ENTER HANDLER

  const handleSend = async () => {
    const clean = userInput.trim();
    if (!clean) return;

    setConversation((prev) => [...prev, { role: "user", text: clean }]);
    setUserInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/objective/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: clean,
          currentObjective: objectiveAst,
        }),
      });

      const data = await res.json();

      setObjectiveAst(data.objective);
      setStage("objective");

      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Objective function generated. Review and approve it.",
        },
      ]);
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Failed to generate objective function." },
      ]);
    }

    setLoading(false);
  };

  const handleKeyDown = async (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

     //APPROVE → AUTO RUN rlTool
  const approveObjective = async () => {
    if (!objectiveAst) return;

    setObjectiveLocked(true);
    setStage("optimizing");

    setConversation((prev) => [
      ...prev,
      { role: "assistant", text: "Optimizing query using rlTool…" },
    ]);

    try {
      const res = await fetch("/api/rl/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: objectiveAst }),
      });

      const data = await res.json();
      setSql(data.sql);
      setStage("sql");

      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "Optimization complete. SQL is ready." },
      ]);
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", text: "rlTool execution failed." },
      ]);
      setStage("objective");
    }
  };
//UI from here
  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2 text-black">Quill chat</h1>
        <p className="text-gray-500 text-sm">Ask me anything about objectiveFunctions and SQL optimization</p>
      </div>

       <div className={`max-w-7xl mx-auto ${objectiveAst || stage === "sql" ? "flex gap-6" : "flex justify-center"}`}>
        <div className={`bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden transition-all ${objectiveAst || stage === "sql" ? "flex-1" : "w-full max-w-3xl"}`}>
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                className="flex-1 p-4 rounded-xl bg-white border border-gray-300 focus:border-blue-500 focus:outline-none resize-none transition-all text-gray-900"
                disabled={objectiveLocked}
              />
              <button
                onClick={handleSend}
                disabled={loading || objectiveLocked}
                className="px-6 py-4 bg-black hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-white"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>

          {stage === "optimizing" && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                Optimizing query...
              </div>
            </div>
          )}
        </div>

        {(objectiveAst || stage === "sql") && (
          <div className="w-[500px] flex flex-col gap-6">
            {objectiveAst && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-black">Objective Function</h2>
                  {!objectiveLocked ? (
                    <button
                      onClick={approveObjective}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors text-white"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => setObjectiveLocked(false)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors text-white"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full h-[300px] rounded-lg bg-gray-50 border border-gray-300 font-mono text-xs p-4 focus:outline-none focus:border-blue-500 text-gray-900"
                  value={JSON.stringify(objectiveAst, null, 2)}
                  onChange={(e) => {
                    try {
                      setObjectiveAst(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  disabled={objectiveLocked}
                />
              </div>
            )}

            {stage === "sql" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 text-black">Generated SQL</h2>
                <textarea
                  className="w-full h-[200px] rounded-lg bg-gray-50 border border-gray-300 font-mono text-sm p-4 mb-4 focus:outline-none focus:border-blue-500 text-gray-900"
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (sql) {
                      router.push(`/results?sql=${encodeURIComponent(sql)}`);
                    }
                  }}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-white"
                >
                  Run Query →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
