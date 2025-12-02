import fs from "fs";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "app", "data", "queryHistory.json");

export interface QueryHistoryItem {
  naturalText: string;
  sqlQuery: string;
  rowCount: number;
  createdAt: string;
} // Define the shape of a query history item
// Ensure folder exists
function ensureFileExists() {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, "[]", "utf8");
}
//ensureFileExists() bootstraps the local persistence layer by 
// auto-creating missing directories and initializing empty JSON files for clean, crash-free history storage.

  //  Read Query History
export function readQueryHistory(): QueryHistoryItem[] {
  try {
    ensureFileExists();
    const text = fs.readFileSync(HISTORY_PATH, "utf8"); // read file content
    const parsed = JSON.parse(text);

    // Ensure array form
    return Array.isArray(parsed) ? parsed : []; // return parsed array or empty if not an array
  } catch (err) {
    console.error("Failed reading history:", err);
    return [];
  }
}

  //  Append Query History with Duplicate Protection

export function appendQueryHistory(item: QueryHistoryItem) { // append new query history item
  try {
    ensureFileExists();
    const history = readQueryHistory();

    // Deduplication logic:
    // Prevent writing the same SQL query repeatedly within 1.5 seconds.
    const duplicateExists = history.some((h) => { // check for duplicates
      const sameSQL = h.sqlQuery === item.sqlQuery && h.naturalText === item.naturalText; //checks both value and type so chose ===
      const timeDiff = Math.abs( // time difference in ms
        new Date(h.createdAt).getTime() - new Date(item.createdAt).getTime() // time difference 
      );
      return sameSQL && timeDiff < 1500; // 1.5s window
    });

    if (duplicateExists) {
      console.log("Skipping duplicate query history entry.");
      return;
    }

    history.push(item); // add new item to history array

    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8"); // write updated history back to file
  } catch (err) {
    console.error("Failed writing history:", err);
  }
}
