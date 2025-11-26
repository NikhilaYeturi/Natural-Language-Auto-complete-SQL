"use client";

import React from "react";

export interface SqlSuggestion {
  description: string;
  sql?: string;
  sqlQuery?: string;
}

interface SuggestionModalProps {
  isOpen: boolean;
  suggestions: SqlSuggestion[];
  onSelect: (sql: string) => void;
  onClose: () => void;
}

export default function SuggestionModal({
  isOpen,
  suggestions,
  onSelect,
  onClose,
}: SuggestionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white text-black w-[550px] max-h-[80vh] overflow-y-auto p-6 rounded-xl shadow-xl animate-fadeIn">

        <h2 className="text-2xl font-semibold mb-4 text-center">
          SQL Suggestions
        </h2>

        {suggestions.length === 0 && (
          <p className="text-center text-gray-700">No suggestions found.</p>
        )}

        {suggestions.map((s, idx) => {
          const sqlText = (s.sql || s.sqlQuery || "").trim();

          return (
            <div
              key={idx}
              className="border border-gray-300 rounded-lg p-4 mb-4 shadow-sm bg-gray-50"
            >
              <p className="font-medium mb-2">{s.description}</p>

              <pre className="bg-gray-200 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {sqlText}
              </pre>

              <button
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
                onClick={() => sqlText && onSelect(sqlText)}
                disabled={!sqlText}
              >
                Use this query
              </button>
            </div>
          );
        })}

        <button
          onClick={onClose}
          className="w-full mt-4 text-gray-600 hover:text-gray-800 underline text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}
