'use client';

import { useEffect, useState } from "react";

export default function QueryHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/query-history");
      const data = await res.json();
  const h = (data || []);
  h.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  setHistory(h);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-white">
        Loading history...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-10">

      <h1 className="text-3xl font-bold mb-6">Query History</h1>

      {history.length === 0 && (
        <p className="text-gray-400">No history yet.</p>
      )}

      <div className="space-y-4">
        {history.map((item, idx) => (
          <div
            key={idx}
            className="bg-gray-800 p-4 rounded-lg border border-gray-700"
          >
            {item.source === 'user' ? (
              <>
                <p className="text-green-300 font-semibold">User input</p>
                <p className="text-white mt-1">{item.naturalText}</p>
              </>
            ) : (
              <>
                <p className="text-blue-300 font-mono">{item.sqlQuery}</p>
                <p className="text-gray-400 mt-2 text-sm">Rows returned: <strong>{item.rowCount}</strong></p>
                <p className="text-gray-400 text-sm mt-1">{item.naturalText}</p>
              </>
            )}

            {/* timestamp intentionally hidden for cleaner history display */}
          </div>
        ))}
      </div>
    </div>
  );
}
