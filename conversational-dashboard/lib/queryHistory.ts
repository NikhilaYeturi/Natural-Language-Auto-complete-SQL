import fs from "fs";
import path from "path";

const HISTORY_PATH = path.join(process.cwd(), "app", "data", "queryHistory.json");

export interface QueryHistoryItem {
  naturalText: string;
  sqlQuery: string;
  rowCount: number;
  createdAt: string;
}

// Ensure folder exists at startup
function ensureFileExists() {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_PATH)) fs.writeFileSync(HISTORY_PATH, "[]", "utf8");
}

export function readQueryHistory(): QueryHistoryItem[] {
  try {
    ensureFileExists();
    const text = fs.readFileSync(HISTORY_PATH, "utf8");
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed reading history:", err);
    return [];
  }
}

export function appendQueryHistory(item: QueryHistoryItem) {
  try {
    ensureFileExists();
    const history = readQueryHistory();
    history.push(item);
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");
  } catch (err) {
    console.error("Failed writing history:", err);
  }
}
