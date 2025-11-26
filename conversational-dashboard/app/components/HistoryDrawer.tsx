'use client';

import { useEffect, useState } from 'react';

interface HistoryItem {
  naturalText: string;
  sqlQuery?: string;
  rowCount?: number;
  createdAt: string;
  source?: 'user' | 'query';
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryDrawer({ isOpen, onClose }: HistoryDrawerProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadHistory() {
      const res = await fetch('/api/query-history'); 
      if (!res.ok) return;

      const data: HistoryItem[] = await res.json();
  // sort newest-first
  data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  setHistory(data);
    }

    loadHistory();
  }, [isOpen]);

  return (
    <div>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-full w-[380px] bg-gray-900 text-white shadow-xl 
          transform transition-transform duration-300 z-50
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Query History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto h-full">
          {history.length === 0 ? (
            <p className="text-gray-400">No history found.</p>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-800 rounded">
                {item.source === 'user' ? (
                  <>
                    <p className="text-sm text-green-300">User input:</p>
                    <p className="text-sm text-white mt-1">{item.naturalText}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-blue-300 font-mono">{item.sqlQuery}</p>
                    {item.rowCount !== undefined && (
                      <p className="text-xs text-gray-400 mt-1">Rows: {item.rowCount}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{item.naturalText}</p>
                  </>
                )}

                
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
